import prisma from '../db/index.js';
import createLogger from '../lib/logger.js';
import { CRON } from './config.js';
import type { MergedCarpark } from './pipeline/types.js';
import { mergeAll } from './pipeline/merge.js';
import { buildSourceIdIndex, resolveCarparkIds } from './pipeline/idResolution.js';
import { planAvailabilityWrite } from './pipeline/refresh.js';
import { fetchMapping, fetchAvailability } from './providers/govsg.js';
import { fetchDatamall } from './providers/datamall.js';
import { fetchLocations, fetchDump, fetchRates } from './providers/parkaholic.js';
import { fetchSgcarmart } from './providers/sgcarmart.js';
import { fetchJustpark, fetchJustparkAvailability } from './providers/justpark.js';
import { fetchUraCapacity } from './providers/uraCapacity.js';
import { fetchUraLive } from './providers/uraLive.js';
import { runScraper, smartSearch } from './scraper/index.js';
import { recordSnapshots, runDailyTrends } from './trends/index.js';
import { applyScraped } from './scraper/apply.js';

const log = createLogger('cron');

let merging = false;
let refreshing = false;
let scraping = false;
let scheduled = false;
let computingTrends = false;

async function upsert(carparks: MergedCarpark[]) {
  const now = new Date();
  for (const cp of carparks) {
    await prisma.carpark.upsert({
      where: { id: cp.id },
      update: { name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address, agency: cp.agency, sources: cp.sources, sourceIds: cp.source_ids, lotTypes: cp.lot_types, metadata: cp.metadata, detailsUpdatedAt: now, active: true },
      create: { id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address, agency: cp.agency, sources: cp.sources, sourceIds: cp.source_ids, lotTypes: cp.lot_types, metadata: cp.metadata, detailsUpdatedAt: now, availabilityUpdatedAt: now },
    });

    if (cp.rates.length) {
      await prisma.rate.deleteMany({ where: { carparkId: cp.id } });
      await prisma.rate.createMany({
        data: cp.rates.map(r => ({
          carparkId: cp.id, amount: r.amount, durationMins: r.duration_mins, unit: r.unit,
          vehicleType: r.vehicle_type, periodStart: r.period_start, periodEnd: r.period_end,
          isFirst: r.is_first, dayType: r.day_type, sources: r.sources,
        })),
      });
    }

    for (const [lt, e] of Object.entries(cp.availability)) {
      await prisma.availability.upsert({
        where: { carparkId_lotType: { carparkId: cp.id, lotType: lt } },
        update: { available: e.available, total: e.total, updatedAt: now },
        create: { carparkId: cp.id, lotType: lt, available: e.available, total: e.total },
      });
    }
  }
  await prisma.$executeRawUnsafe(`UPDATE carparks SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat != 0 AND lng != 0 AND geom IS NULL`);
  log.info(`upserted ${carparks.length} carparks`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function bulkInsert(carparks: MergedCarpark[]) {
  const now = new Date();
  const carparkRows = carparks.map(cp => ({
    id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address, agency: cp.agency,
    sources: cp.sources, sourceIds: cp.source_ids, lotTypes: cp.lot_types, metadata: cp.metadata,
    detailsUpdatedAt: now, availabilityUpdatedAt: now,
  }));
  const rateRows = carparks.flatMap(cp => cp.rates.map(r => ({
    carparkId: cp.id, amount: r.amount, durationMins: r.duration_mins, unit: r.unit,
    vehicleType: r.vehicle_type, periodStart: r.period_start, periodEnd: r.period_end,
    isFirst: r.is_first, dayType: r.day_type, sources: r.sources,
  })));
  const availabilityRows = carparks.flatMap(cp => Object.entries(cp.availability).map(([lt, e]) => ({
    carparkId: cp.id, lotType: lt, available: e.available, total: e.total,
  })));

  for (const batch of chunk(carparkRows, 2000)) await prisma.carpark.createMany({ data: batch, skipDuplicates: true });
  for (const batch of chunk(rateRows, 2000)) await prisma.rate.createMany({ data: batch, skipDuplicates: true });
  for (const batch of chunk(availabilityRows, 2000)) await prisma.availability.createMany({ data: batch, skipDuplicates: true });

  await prisma.$executeRawUnsafe(`UPDATE carparks SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat != 0 AND lng != 0 AND geom IS NULL`);
  log.info(`bulk inserted ${carparkRows.length} carparks, ${rateRows.length} rates, ${availabilityRows.length} availability`);
}

async function refreshAvailability() {
  if (refreshing) return;
  refreshing = true;
  try {
    const [govR, dmR, pkR, jpR, uraR] = await Promise.allSettled([fetchAvailability(), fetchDatamall(), fetchDump(), fetchJustparkAvailability(), fetchUraLive()]);
    const gov = govR.status === 'fulfilled' ? govR.value : {};
    const dm = dmR.status === 'fulfilled' ? dmR.value : { availability: {} };
    const pk = pkR.status === 'fulfilled' ? pkR.value : {};
    const jp = jpR.status === 'fulfilled' ? jpR.value : {};
    const ura = uraR.status === 'fulfilled' ? uraR.value : { records: [], availability: {} };
    const now = new Date();
    const touched = new Set<string>();

    const carparkIds = await prisma.carpark.findMany({ select: { id: true, sourceIds: true } });
    const sourceIdIndex = buildSourceIdIndex(carparkIds.map(cp => ({ id: cp.id, sourceIds: cp.sourceIds as Record<string, string> })));

    async function updateAvail(source: string, providerId: string, lotType: string, available: number | null, total: number | null) {
      for (const carparkId of resolveCarparkIds(sourceIdIndex, source, providerId)) {
        const existing = await prisma.availability.findUnique({ where: { carparkId_lotType: { carparkId, lotType } } });
        const write = planAvailabilityWrite(existing, { available, total });
        if (!write) continue;
        await prisma.availability.upsert({
          where: { carparkId_lotType: { carparkId, lotType } },
          update: { available: write.available, total: write.total, updatedAt: now },
          create: { carparkId, lotType, available: write.available, total: write.total },
        });
        touched.add(carparkId);
      }
    }

    for (const [id, lots] of Object.entries(gov)) {
      for (const [lt, e] of Object.entries(lots)) await updateAvail('gov', id, lt, e.available, e.total);
    }
    for (const [id, lots] of Object.entries(dm.availability)) {
      for (const [lt, e] of Object.entries(lots)) await updateAvail('datamall', id, lt, e.available, null);
    }
    for (const [id, d] of Object.entries(pk)) {
      for (const [lt, e] of Object.entries(d.availability)) await updateAvail('parkaholic', id, lt, e.available, e.total);
    }
    for (const [jpId, lots] of Object.entries(jp)) {
      for (const [lt, e] of Object.entries(lots)) await updateAvail('justpark', jpId, lt, e.available, e.total);
    }
    for (const [id, lots] of Object.entries(ura.availability)) {
      for (const [lt, e] of Object.entries(lots)) await updateAvail('ura', id, lt, e.available, e.total);
    }

    if (touched.size) await prisma.carpark.updateMany({ where: { id: { in: [...touched] } }, data: { availabilityUpdatedAt: now } });
    const fails = [govR, dmR, pkR, jpR, uraR].filter(r => r.status === 'rejected').length;
    log.info(`availability: ${touched.size} carparks${fails ? ` (${fails} failed)` : ''}`);
  } catch (e) { log.error('availability refresh failed', e); }
  finally { refreshing = false; }
}

async function fullMerge(): Promise<MergedCarpark[]> {
  log.info('full merge starting');
  const t0 = Date.now();

  const results = await Promise.allSettled([fetchMapping(), fetchAvailability(), fetchDatamall(), fetchLocations(), fetchDump(), fetchSgcarmart(), fetchJustpark(), fetchUraCapacity(), fetchUraLive()]);
  const val = <T>(r: PromiseSettledResult<T>, fallback: T) => r.status === 'fulfilled' ? r.value : fallback;

  const gov = val(results[0], [] as Awaited<ReturnType<typeof fetchMapping>>);
  const govAvail = val(results[1], {} as Awaited<ReturnType<typeof fetchAvailability>>);
  const dm = val(results[2], { records: [], availability: {}, agencies: {} } as Awaited<ReturnType<typeof fetchDatamall>>);
  const parkLocs = val(results[3], [] as Awaited<ReturnType<typeof fetchLocations>>);
  const parkDump = val(results[4], {} as Awaited<ReturnType<typeof fetchDump>>);
  const sgc = val(results[5], [] as Awaited<ReturnType<typeof fetchSgcarmart>>);
  const jp = val(results[6], { records: [], availability: {} } as Awaited<ReturnType<typeof fetchJustpark>>);
  const uraCap = val(results[7], {} as Awaited<ReturnType<typeof fetchUraCapacity>>);
  const uraLive = val(results[8], { records: [], availability: {} } as Awaited<ReturnType<typeof fetchUraLive>>);

  const fails = results.filter(r => r.status === 'rejected');
  if (fails.length) for (const f of fails) if (f.status === 'rejected') log.warn(`source failed: ${f.reason}`);

  const ids = new Set([...gov.map(r => r.id), ...parkLocs.map(r => r.id)]);
  const parkRates = ids.size ? await fetchRates([...ids]) : {};
  const merged = mergeAll(gov, govAvail, dm, parkLocs, parkDump, parkRates, sgc, [], jp, uraCap, uraLive.records);

  if (await dbHasData()) {
    await upsert(merged);
  } else {
    await bulkInsert(merged);
  }

  await deactivateCollapsedTwins();

  log.info(`merge done - ${merged.length} carparks in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return merged;
}

async function deactivateCollapsedTwins(): Promise<void> {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE carparks b SET active = false
    WHERE b.active
      AND EXISTS (
        SELECT 1 FROM carparks t
        WHERE (t.id = 'URA-' || b.id OR t.id = 'LTA-' || b.id) AND t.active
          AND abs(t.lat - b.lat) <= 0.001 AND abs(t.lng - b.lng) <= 0.001
      )`);
  if (result) log.info(`retired ${result} stale bare-id twin pins`);
}

async function dbHasData(): Promise<boolean> {
  const count = await prisma.carpark.count();
  return count > 0;
}

async function bootstrap() {
  const hasData = await dbHasData();
  if (hasData) log.info(`db has ${await prisma.carpark.count()} carparks, running startup merge`);
  else log.info('empty db, running initial merge');
  await fullMerge();
}

function schedule() {
  if (scheduled) { log.warn('schedule already active, skipping'); return; }
  scheduled = true;
  const delay = 60000 - (Date.now() % 60000);
  log.info(`scheduling - availability: 1min (in ${(delay / 1000).toFixed(0)}s) | merge: 6hr | scraper: 30d`);

  setTimeout(() => { refreshAvailability(); setInterval(refreshAvailability, CRON.availabilityInterval); }, delay);

  setInterval(async () => {
    if (merging) return;
    merging = true;
    try { await fullMerge(); } catch (e) { log.error('merge failed', e); } finally { merging = false; }
  }, CRON.fullMergeInterval);

  let lastScraperRun = 0;
  setInterval(async () => {
    const daysSinceLast = (Date.now() - lastScraperRun) / (24 * 60 * 60 * 1000);
    if (daysSinceLast < CRON.scraperRunEveryDays) return;
    if (scraping) return;
    scraping = true;
    try {
      const results = [...await runScraper(), ...await smartSearch()];
      await applyScraped(results);
      lastScraperRun = Date.now();
    }
    catch (e) { log.error('scraper failed', e); }
    finally { scraping = false; }
  }, CRON.scraperCheckInterval);

  const snapshotDelay = 3600000 - (Date.now() % 3600000);
  setTimeout(() => {
    recordSnapshots().catch(e => log.error('snapshot failed', e));
    setInterval(() => recordSnapshots().catch(e => log.error('snapshot failed', e)), CRON.snapshotInterval);
  }, snapshotDelay);

  let lastTrendDay = '';
  const catchUpTrends = async (now: Date) => {
    const day = now.toDateString();
    if (day === lastTrendDay || computingTrends) return;
    lastTrendDay = day;
    computingTrends = true;
    try { await runDailyTrends(now); } catch (e) { log.error('daily trends failed', e); }
    finally { computingTrends = false; }
  };

  recordSnapshots()
    .catch(e => log.error('snapshot failed', e))
    .then(() => catchUpTrends(new Date()))
    .catch(e => log.error('trend catch-up failed', e));

  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== 0) return;
    await catchUpTrends(now);
  }, CRON.trendCheckInterval);
}

export async function startCron() {
  try { await bootstrap(); schedule(); }
  catch (e) { log.error('bootstrap failed', e); }
}

export async function shutdown() {
  log.info('shutting down');
  try { await prisma.$disconnect(); }
  catch (e) { log.error('shutdown failed', e); }
}
