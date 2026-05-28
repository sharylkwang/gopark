import prisma from '../db/index.js';
import createLogger from '../lib/logger.js';
import { CRON } from './config.js';
import type { MergedCarpark } from './pipeline/types.js';
import { mergeAll } from './pipeline/merge.js';
import { fetchMapping, fetchAvailability } from './providers/govsg.js';
import { fetchDatamall } from './providers/datamall.js';
import { fetchLocations, fetchDump, fetchRates } from './providers/parkaholic.js';
import { fetchSgcarmart } from './providers/sgcarmart.js';
import { runScraper, smartSearch } from './scraper/index.js';
import { seedExists, loadSeed, saveSeed, exportDb } from './seed.js';

const log = createLogger('cron');

let merging = false;
let refreshing = false;
let scraping = false;

async function upsert(carparks: MergedCarpark[]) {
  const now = new Date();
  for (const cp of carparks) {
    await prisma.carpark.upsert({
      where: { id: cp.id },
      update: { name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address, agency: cp.agency, sources: cp.sources, lotTypes: cp.lot_types, metadata: cp.metadata, detailsUpdatedAt: now },
      create: { id: cp.id, name: cp.name, lat: cp.lat, lng: cp.lng, address: cp.address, agency: cp.agency, sources: cp.sources, lotTypes: cp.lot_types, metadata: cp.metadata, detailsUpdatedAt: now, availabilityUpdatedAt: now },
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
  log.info(`upserted ${carparks.length} carparks`);
}

async function refreshAvailability() {
  if (refreshing) return;
  refreshing = true;
  try {
    const [govR, dmR, pkR] = await Promise.allSettled([fetchAvailability(), fetchDatamall(), fetchDump()]);
    const gov = govR.status === 'fulfilled' ? govR.value : {};
    const dm = dmR.status === 'fulfilled' ? dmR.value : { availability: {} };
    const pk = pkR.status === 'fulfilled' ? pkR.value : {};
    const now = new Date();
    const touched = new Set<string>();

    for (const [id, lots] of Object.entries(gov)) {
      for (const [lt, e] of Object.entries(lots)) {
        await prisma.availability.updateMany({ where: { carparkId: id, lotType: lt }, data: { available: e.available, total: e.total, updatedAt: now } });
        touched.add(id);
      }
    }
    for (const [id, lots] of Object.entries(dm.availability)) {
      for (const [lt, e] of Object.entries(lots)) {
        await prisma.availability.updateMany({ where: { carparkId: id, lotType: lt }, data: { available: e.available, updatedAt: now } });
        touched.add(id);
      }
    }
    for (const [id, d] of Object.entries(pk)) {
      for (const [lt, e] of Object.entries(d.availability)) {
        await prisma.availability.updateMany({ where: { carparkId: id, lotType: lt }, data: { available: e.available, updatedAt: now } });
        touched.add(id);
      }
    }

    if (touched.size) await prisma.carpark.updateMany({ where: { id: { in: [...touched] } }, data: { availabilityUpdatedAt: now } });
    const fails = [govR, dmR, pkR].filter(r => r.status === 'rejected').length;
    log.info(`availability: ${touched.size} carparks${fails ? ` (${fails} failed)` : ''}`);
  } catch (e) { log.error('availability refresh failed', e); }
  finally { refreshing = false; }
}

async function fullMerge(): Promise<MergedCarpark[]> {
  log.info('full merge starting');
  const t0 = Date.now();

  const results = await Promise.allSettled([fetchMapping(), fetchAvailability(), fetchDatamall(), fetchLocations(), fetchDump(), fetchSgcarmart()]);
  const val = <T>(r: PromiseSettledResult<T>, fallback: T) => r.status === 'fulfilled' ? r.value : fallback;

  const gov = val(results[0], [] as Awaited<ReturnType<typeof fetchMapping>>);
  const govAvail = val(results[1], {} as Awaited<ReturnType<typeof fetchAvailability>>);
  const dm = val(results[2], { records: [], availability: {}, agencies: {} } as Awaited<ReturnType<typeof fetchDatamall>>);
  const parkLocs = val(results[3], [] as Awaited<ReturnType<typeof fetchLocations>>);
  const parkDump = val(results[4], {} as Awaited<ReturnType<typeof fetchDump>>);
  const sgc = val(results[5], [] as Awaited<ReturnType<typeof fetchSgcarmart>>);

  const fails = results.filter(r => r.status === 'rejected');
  if (fails.length) for (const f of fails) if (f.status === 'rejected') log.warn(`source failed: ${f.reason}`);

  const ids = new Set([...gov.map(r => r.id), ...parkLocs.map(r => r.id)]);
  const parkRates = ids.size ? await fetchRates([...ids]) : {};
  const merged = mergeAll(gov, govAvail, dm, parkLocs, parkDump, parkRates, sgc, []);

  await upsert(merged);
  await saveSeed(merged);
  log.info(`merge done — ${merged.length} carparks in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return merged;
}

async function dbHasData(): Promise<boolean> {
  const count = await prisma.carpark.count();
  return count > 0;
}

async function bootstrap() {
  if (await dbHasData()) {
    log.info(`db already seeded (${await prisma.carpark.count()} carparks), skipping seed`);
    return;
  }

  if (seedExists()) {
    log.info('loading seed cache');
    await upsert(await loadSeed());
  } else {
    log.info('no seed cache, running initial merge');
    await fullMerge();
  }
}

function schedule() {
  const delay = 60000 - (Date.now() % 60000);
  log.info(`scheduling — availability: 1min (in ${(delay / 1000).toFixed(0)}s) | merge: 6hr | scraper: 30d`);

  setTimeout(() => { refreshAvailability(); setInterval(refreshAvailability, CRON.availabilityInterval); }, delay);

  setInterval(async () => {
    if (merging) return;
    merging = true;
    try { await fullMerge(); } catch (e) { log.error('merge failed', e); } finally { merging = false; }
  }, CRON.fullMergeInterval);

  setInterval(async () => {
    if (scraping) return;
    scraping = true;
    try { await runScraper(); await smartSearch(); } catch (e) { log.error('scraper failed', e); } finally { scraping = false; }
  }, CRON.scraperInterval);
}

export async function startCron() {
  try { await bootstrap(); schedule(); }
  catch (e) { log.error('bootstrap failed', e); }
}

export async function shutdown() {
  log.info('shutting down');
  try { await exportDb(); await prisma.$disconnect(); }
  catch (e) { log.error('shutdown failed', e); }
}
