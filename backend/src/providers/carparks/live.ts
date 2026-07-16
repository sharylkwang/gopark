import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';

const log = createLogger('live');

const PATH = '/api/carparks/live';
const POLL_MS = 15000;
const HEARTBEAT_MS = 30000;
const MAX_SUBSCRIPTIONS = 200;

type LotState = { available: number | null; total: number | null };
type CarparkState = Record<string, LotState>;

interface Client {
  socket: WebSocket;
  ids: Set<string>;
  alive: boolean;
}

const clients = new Set<Client>();

const snapshot = new Map<string, CarparkState>();

function changed(before: CarparkState | undefined, after: CarparkState) {
  if (!before) return true;
  const lots = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const lot of lots) {
    if (before[lot]?.available !== after[lot]?.available) return true;
    if (before[lot]?.total !== after[lot]?.total) return true;
  }
  return false;
}

async function readAvailability(ids: string[]): Promise<Map<string, CarparkState>> {
  const rows = await prisma.availability.findMany({
    where: { carparkId: { in: ids } },
    select: { carparkId: true, lotType: true, available: true, total: true },
  });

  const byCarpark = new Map<string, CarparkState>();
  for (const row of rows) {
    const state = byCarpark.get(row.carparkId) ?? {};
    state[row.lotType] = { available: row.available, total: row.total };
    byCarpark.set(row.carparkId, state);
  }
  return byCarpark;
}

function send(client: Client, carparks: Record<string, CarparkState>) {
  if (client.socket.readyState !== WebSocket.OPEN) return;
  if (!Object.keys(carparks).length) return;

  client.socket.send(JSON.stringify({
    type: 'availability',
    updatedAt: new Date().toISOString(),
    carparks,
  }));
}

async function pushUpdates() {
  if (!clients.size) return;

  const watched = new Set<string>();
  for (const client of clients) {
    for (const id of client.ids) watched.add(id);
  }
  if (!watched.size) return;

  try {
    const current = await readAvailability([...watched]);

    const updated = new Map<string, CarparkState>();
    for (const [id, state] of current) {
      if (changed(snapshot.get(id), state)) {
        updated.set(id, state);
        snapshot.set(id, state);
      }
    }
    if (!updated.size) return;

    for (const client of clients) {
      const forClient: Record<string, CarparkState> = {};
      for (const [id, state] of updated) {
        if (client.ids.has(id)) forClient[id] = state;
      }
      send(client, forClient);
    }

    log.debug(`pushed ${updated.size} carpark updates to ${clients.size} client(s)`);
  } catch (e) {
    log.warn(`live availability poll failed: ${e instanceof Error ? e.message : e}`);
  }
}

export function startLiveAvailability(server: Server) {
  const wss = new WebSocketServer({ server, path: PATH });

  wss.on('connection', socket => {
    const client: Client = { socket, ids: new Set(), alive: true };
    clients.add(client);

    socket.on('pong', () => { client.alive = true; });

    socket.on('message', async raw => {
      let msg: any;
      try { msg = JSON.parse(String(raw)); } catch { return; }

      if (msg?.type !== 'subscribe' || !Array.isArray(msg.ids)) return;

      client.ids = new Set(
        msg.ids.filter((id: unknown) => typeof id === 'string').slice(0, MAX_SUBSCRIPTIONS),
      );

      if (client.ids.size) {
        const current = await readAvailability([...client.ids]);
        const initial: Record<string, CarparkState> = {};
        for (const [id, state] of current) {
          initial[id] = state;
          snapshot.set(id, state);
        }
        send(client, initial);
      }
    });

    socket.on('close', () => { clients.delete(client); });
    socket.on('error', () => { clients.delete(client); });
  });

  const poll = setInterval(pushUpdates, POLL_MS);

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate();
        clients.delete(client);
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => {
    clearInterval(poll);
    clearInterval(heartbeat);
  });

  log.info(`live availability socket listening on ${PATH}`);
  return wss;
}
