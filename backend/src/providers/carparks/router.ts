import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../../db/index.js';
import { runScraper, smartSearch } from '../../cron/scraper/index.js';
import { applyScraped } from '../../cron/scraper/apply.js';
import createLogger from '../../lib/logger.js';
import { requireAuth } from '../../middleware/auth.js';

const log = createLogger('carparks-api');
const router = Router();

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LIST_SELECT = {
  id: true, name: true, lat: true, lng: true, address: true,
  agency: true, sources: true, lotTypes: true,
  availability: { select: { lotType: true, available: true, total: true } },
} as const;

const NEARBY_SELECT = {
  ...LIST_SELECT,
  rates: {
    select: {
      amount: true, durationMins: true, unit: true, vehicleType: true,
      periodStart: true, periodEnd: true, isFirst: true, dayType: true, sources: true,
    },
  },
} as const;

function formatCarpark(cp: { id: string; name: string; lat: number; lng: number; address: string; agency: string; sources: string[]; lotTypes: string; availability: { lotType: string; available: number | null; total: number | null }[] }) {
  return {
    id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address,
    agency: cp.agency, sources: cp.sources, lotTypes: cp.lotTypes,
    availability: Object.fromEntries(cp.availability.map(a => [a.lotType, { available: a.available, total: a.total }])),
  };
}

function formatRate(r: { amount: unknown; durationMins: number | null; unit: string; vehicleType: string; periodStart: string | null; periodEnd: string | null; isFirst: boolean; dayType: string; sources: string[] }) {
  return {
    amount: Number(r.amount), durationMins: r.durationMins, unit: r.unit,
    vehicleType: r.vehicleType, periodStart: r.periodStart, periodEnd: r.periodEnd,
    isFirst: r.isFirst, dayType: r.dayType, sources: r.sources, confirmedBy: r.sources.length,
  };
}

router.get('/carparks', async (_req: Request, res: Response) => {
  const rows = await prisma.carpark.findMany({ where: { active: true }, select: LIST_SELECT });
  res.json(rows.map(formatCarpark));
});

router.get('/carparks/nearby', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  let radius = parseFloat(req.query.radius as string) || 1000;
  let limit = parseInt(req.query.limit as string) || 50;

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  if (radius > 5000) radius = 5000;
  if (radius < 100) radius = 100;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = 1;

  const rows = await prisma.carpark.findMany({ where: { active: true }, select: NEARBY_SELECT });
  const nearby = rows
    .map(cp => ({
      ...formatCarpark(cp),
      distance: Math.round(haversine(lat, lng, cp.lat, cp.lng)),
      rates: cp.rates.map(formatRate),
    }))
    .filter(cp => cp.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  res.json(nearby);
});

router.get('/carparks/availability', async (_req: Request, res: Response) => {
  const rows = await prisma.availability.findMany({
    select: { carparkId: true, lotType: true, available: true, total: true, updatedAt: true },
  });

  const grouped: Record<string, Record<string, { available: number | null; total: number | null; updatedAt: Date }>> = {};
  let latest: Date | null = null;
  for (const row of rows) {
    if (!grouped[row.carparkId]) grouped[row.carparkId] = {};
    grouped[row.carparkId][row.lotType] = { available: row.available, total: row.total, updatedAt: row.updatedAt };
    if (!latest || row.updatedAt > latest) latest = row.updatedAt;
  }

  res.json({ updatedAt: latest, carparks: grouped });
});

router.get('/carparks/:id', async (req: Request, res: Response) => {
  const cp = await prisma.carpark.findUnique({
    where: { id: req.params.id as string },
    include: {
      rates: { select: { amount: true, durationMins: true, unit: true, vehicleType: true, periodStart: true, periodEnd: true, isFirst: true, dayType: true, sources: true } },
      availability: { select: { lotType: true, available: true, total: true, updatedAt: true } },
    },
  });

  if (!cp) { res.status(404).json({ error: 'Not found' }); return; }

  res.json({
    id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address,
    agency: cp.agency, sources: cp.sources, sourceIds: cp.sourceIds, lotTypes: cp.lotTypes,
    metadata: cp.metadata,
    detailsUpdatedAt: cp.detailsUpdatedAt,
    availabilityUpdatedAt: cp.availabilityUpdatedAt,
    rates: cp.rates.map(formatRate),
    availability: Object.fromEntries(
      cp.availability.map(a => [a.lotType, { available: a.available, total: a.total, updatedAt: a.updatedAt }])
    ),
  });
});

router.post('/carparks/scrape', requireAuth, async (req: Request, res: Response) => {
  try {
    const full = req.query.full === 'true';
    const results = full ? [...await runScraper(), ...await smartSearch()] : await smartSearch();
    const total = results.reduce((sum, r) => sum + r.carparks.length, 0);
    await applyScraped(results);

    const sample = results.flatMap(r => r.carparks.map(cp => ({
      source: r.source,
      name: cp.name,
      address: cp.address ?? null,
      rates: (cp.rates ?? []).slice(0, 3),
    }))).slice(0, 5);

    res.json({ carparks: total, sources: results.length, sample });
  } catch (err) {
    log.error('scrape failed', err);
    res.status(500).json({ error: 'Scrape failed' });
  }
});

export default router;
