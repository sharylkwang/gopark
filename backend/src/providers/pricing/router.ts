import { Router, type Request, type Response } from 'express';
import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';
import { estimateCost, type PricingRate } from '../../lib/pricing.js';

const log = createLogger('pricing');

const MAX_DURATION_MINS = 60 * 24 * 14;

const RATE_SELECT = {
  amount: true, durationMins: true, unit: true, vehicleType: true,
  periodStart: true, periodEnd: true, isFirst: true, dayType: true,
} as const;

function toRate(r: { amount: unknown; durationMins: number | null; unit: string; vehicleType: string; periodStart: string | null; periodEnd: string | null; isFirst: boolean; dayType: string }): PricingRate {
  return {
    amount: Number(r.amount),
    durationMins: r.durationMins,
    unit: r.unit,
    vehicleType: r.vehicleType,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    isFirst: r.isFirst,
    dayType: r.dayType,
  };
}

const router = Router();

router.get('/pricing/quote', async (req: Request, res: Response) => {
  const carparkId = String(req.query.carparkId ?? '');
  const vehicleType = String(req.query.vehicleType ?? 'C');
  const durationMins = Number(req.query.durationMins);
  const atRaw = req.query.at ? String(req.query.at) : null;

  if (!carparkId) {
    return res.status(400).json({ error: 'carparkId is required' });
  }
  if (!Number.isFinite(durationMins) || durationMins <= 0 || durationMins > MAX_DURATION_MINS) {
    return res.status(400).json({ error: 'durationMins must be a positive number of minutes' });
  }

  const at = atRaw ? new Date(atRaw) : new Date();
  if (Number.isNaN(at.getTime())) {
    return res.status(400).json({ error: 'at must be an ISO timestamp' });
  }

  const rows = await prisma.rate.findMany({ where: { carparkId }, select: RATE_SELECT });
  const cost = estimateCost(rows.map(toRate), durationMins, vehicleType, at);

  res.set('Cache-Control', 'no-store');
  res.json({ carparkId, vehicleType, durationMins, at: at.toISOString(), cost });
});

log.debug('pricing routes ready');

export default router;
