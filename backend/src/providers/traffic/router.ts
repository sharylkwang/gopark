import { Router, type Request, type Response } from 'express';
import datamallClient from '../../lib/datamallClient';
import createLogger from '../../lib/logger.js';
import { parseIncident, type TrafficIncident } from './parse.js';

const log = createLogger('traffic');

const CACHE_TTL = 60 * 1000;

let cache: { incidents: TrafficIncident[]; ts: number } | null = null;
let inFlight: Promise<TrafficIncident[]> | null = null;

async function loadIncidents(): Promise<TrafficIncident[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.incidents;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data } = await datamallClient.get('/TrafficIncidents');
      const incidents = (data.value ?? [])
        .map(parseIncident)
        .filter((i: TrafficIncident | null): i is TrafficIncident => i !== null);
      cache = { incidents, ts: Date.now() };
      return incidents;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

const router = Router();

router.get('/traffic/incidents', async (_req: Request, res: Response) => {
  if (!process.env.DATAMALL_API) {
    return res.status(503).json({ error: 'Traffic feed is not configured' });
  }

  try {
    const incidents = await loadIncidents();
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ incidents });
  } catch (e) {
    if (cache) {
      res.set('Cache-Control', 'public, max-age=30');
      return res.json({ incidents: cache.incidents, stale: true });
    }
    log.warn(`traffic incidents fetch failed: ${e instanceof Error ? e.message : e}`);
    res.status(502).json({ error: 'Traffic feed is not responding' });
  }
});

export default router;
