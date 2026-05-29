import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import prisma from '../db/index.js';
import createLogger from '../lib/logger.js';
import type { MergedCarpark } from './pipeline/types.js';

const log = createLogger('seed');
const SEED_PATH = path.resolve('data/seed.json');

export function seedExists() { return existsSync(SEED_PATH); }

export async function loadSeed(): Promise<MergedCarpark[]> {
  const data = JSON.parse(await readFile(SEED_PATH, 'utf-8')) as MergedCarpark[];
  log.info(`loaded ${data.length} carparks from cache`);
  return data;
}

export async function saveSeed(carparks: MergedCarpark[]) {
  const dir = path.dirname(SEED_PATH);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(SEED_PATH, JSON.stringify(carparks));
  log.info(`saved ${carparks.length} carparks to cache`);
}

export async function exportDb() {
  const rows = await prisma.carpark.findMany({ include: { rates: true, availability: true } });
  if (!rows.length) { log.debug('db empty, skipping export'); return; }

  const data: MergedCarpark[] = rows.map(cp => ({
    id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address,
    agency: cp.agency, sources: cp.sources, source_ids: cp.sourceIds as Record<string, string>, source_count: cp.sources.length,
    lot_types: cp.lotTypes, metadata: cp.metadata as Record<string, unknown>,
    last_updated: cp.detailsUpdatedAt.toISOString(),
    rates: cp.rates.map(r => ({
      amount: Number(r.amount), duration_mins: r.durationMins, unit: r.unit,
      vehicle_type: r.vehicleType, period_start: r.periodStart, period_end: r.periodEnd,
      is_first: r.isFirst, day_type: r.dayType, source: r.sources[0] ?? 'unknown',
      sources: r.sources, confirmed_by: r.sources.length,
    })),
    availability: Object.fromEntries(cp.availability.map(a => [a.lotType, { available: a.available, total: a.total }])),
  }));

  await saveSeed(data);
}
