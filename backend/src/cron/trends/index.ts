import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';
import { occupancyPct, resolveTrend, type Snapshot } from './aggregate.js';

const log = createLogger('trends');

const HISTORY_MONTHS = 6;
const RETENTION_MONTHS = 7;

export async function recordSnapshots(): Promise<number> {
  const rows = await prisma.availability.findMany({
    where: { lotType: 'C' },
    select: { carparkId: true, available: true, total: true },
  });

  const now = new Date();
  const data = rows
    .map(r => ({ carparkId: r.carparkId, occupancyPct: occupancyPct(r.available, r.total), recordedAt: now }))
    .filter((r): r is { carparkId: string; occupancyPct: number; recordedAt: Date } => r.occupancyPct != null);

  if (!data.length) return 0;
  await prisma.availabilitySnapshot.createMany({ data });
  log.debug(`recorded ${data.length} occupancy snapshots`);
  return data.length;
}

async function pruneOldSnapshots(): Promise<void> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const { count } = await prisma.availabilitySnapshot.deleteMany({ where: { recordedAt: { lt: cutoff } } });
  if (count) log.info(`pruned ${count} snapshots older than ${RETENTION_MONTHS} months`);
}

export async function runDailyTrends(today = new Date()): Promise<number> {
  await pruneOldSnapshots();

  const since = new Date();
  since.setMonth(since.getMonth() - HISTORY_MONTHS);

  const carparkIds = (await prisma.availabilitySnapshot.findMany({
    where: { recordedAt: { gte: since } },
    select: { carparkId: true },
    distinct: ['carparkId'],
  })).map(r => r.carparkId);

  if (!carparkIds.length) {
    log.info('no snapshot history yet - trends will use the default curve until data accrues');
  }

  const active = await prisma.carpark.findMany({ where: { active: true }, select: { id: true } });
  const targets = new Set([...carparkIds, ...active.map(c => c.id)]);

  let written = 0;
  for (const carparkId of targets) {
    const rows = await prisma.availabilitySnapshot.findMany({
      where: { carparkId, recordedAt: { gte: since } },
      select: { occupancyPct: true, recordedAt: true },
    });
    const snapshots: Snapshot[] = rows.map(r => ({ occupancyPct: r.occupancyPct, recordedAt: r.recordedAt }));

    const trend = resolveTrend(snapshots, today);
    await prisma.carparkTrend.upsert({
      where: { carparkId },
      create: {
        carparkId,
        profile: trend.weekday,
        todayProfile: trend.today,
        todaySource: trend.todaySource,
        isHoliday: trend.isHoliday,
        sampleCount: trend.sampleCount,
      },
      update: {
        profile: trend.weekday,
        todayProfile: trend.today,
        todaySource: trend.todaySource,
        isHoliday: trend.isHoliday,
        sampleCount: trend.sampleCount,
        computedAt: new Date(),
      },
    });
    written++;
  }

  log.info(`daily trends computed for ${written} carparks (history from ${carparkIds.length})`);
  return written;
}
