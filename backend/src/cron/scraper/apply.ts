import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';
import { SCRAPER } from '../config.js';
import { isInSingapore } from '../../lib/geofence.js';
import { geocode } from './geocode.js';
import type { ScrapedResult, ScrapedCarpark } from '../pipeline/types.js';
import { VT_MAP, normalize } from '../pipeline/merge.js';

const log = createLogger('scraper-apply');

const SCRAPER_SOURCES = new Set<string>([...SCRAPER.domains.map(d => d.domain), 'smart_search']);

function isScraperManaged(sources: string[]): boolean {
  return sources.length > 0 && sources.every(s => SCRAPER_SOURCES.has(s));
}

function scrapeId(name: string, lat: number, lng: number): string {
  return `scrape_${normalize(name).slice(0, 32)}_${lat.toFixed(5)}_${lng.toFixed(5)}`;
}

interface Existing { id: string; name: string; address: string; sources: string[]; }

function findMatch(existing: Existing[], name: string): Existing | null {
  const norm = normalize(name);
  if (norm.length < 6) return null;
  for (const cp of existing) {
    const e = normalize(cp.name || cp.address);
    if (!e || e.length < 6) continue;
    if (norm === e) return cp;
    const shorter = norm.length < e.length ? norm : e;
    if (shorter.length >= 8 && (norm.includes(e) || e.includes(norm))) return cp;
  }
  return null;
}

function mapRates(sc: ScrapedCarpark, source: string) {
  return (sc.rates ?? [])
    .filter(r => r.amount_dollars != null)
    .map(r => {
      const per = r.per_minutes && r.per_minutes > 0 ? r.per_minutes : null;
      return {
        amount: r.amount_dollars ?? 0,
        durationMins: per,
        unit: per ? `per_${per}min` : 'flat',
        vehicleType: VT_MAP[r.vehicle_type ?? 'car'] ?? 'C',
        periodStart: r.time_start ?? null,
        periodEnd: r.time_end ?? null,
        isFirst: r.is_first_block ?? false,
        dayType: r.day_type ?? 'all',
        sources: [source],
      };
    });
}

async function addRates(carparkId: string, source: string, rates: ReturnType<typeof mapRates>) {
  await prisma.rate.deleteMany({ where: { carparkId, sources: { has: source } } });
  if (!rates.length) return;
  await prisma.rate.createMany({ data: rates.map(r => ({ carparkId, ...r })) });
}

function withSource(sources: string[], source: string): string[] {
  return sources.includes(source) ? sources : [...sources, source];
}

export async function applyScraped(results: ScrapedResult[]): Promise<void> {
  const incoming = results.flatMap(r => r.carparks.map(cp => ({ cp, source: r.source })));
  if (!incoming.length) { log.debug('nothing scraped to apply'); return; }

  const existing: Existing[] = await prisma.carpark.findMany({ select: { id: true, name: true, address: true, sources: true } });
  const seen = new Set<string>();
  const now = new Date();
  let matched = 0, created = 0, skipped = 0;

  for (const { cp, source } of incoming) {
    const name = (cp.name ?? '').trim();
    if (name.length < 4) { skipped++; continue; }
    const rates = mapRates(cp, source);

    const hit = findMatch(existing, name);
    if (hit) {
      seen.add(hit.id);
      await addRates(hit.id, source, rates);
      hit.sources = withSource(hit.sources, source);
      await prisma.carpark.update({ where: { id: hit.id }, data: { sources: hit.sources, scrapeMisses: 0, active: true, detailsUpdatedAt: now } });
      matched++;
      continue;
    }

    const geo = await geocode(cp.address?.trim() || `${name}, Singapore`);
    if (!geo || !isInSingapore(geo.lat, geo.lng)) { skipped++; continue; }

    const id = scrapeId(name, geo.lat, geo.lng);
    if (seen.has(id)) { await addRates(id, source, rates); continue; }
    seen.add(id);

    await prisma.carpark.upsert({
      where: { id },
      create: { id, name, lat: geo.lat, lng: geo.lng, address: cp.address?.trim() ?? '', agency: '', sources: [source], sourceIds: {}, lotTypes: '', metadata: { scraped: true }, detailsUpdatedAt: now, availabilityUpdatedAt: now, active: true, scrapeMisses: 0 },
      update: { sources: [source], scrapeMisses: 0, active: true, detailsUpdatedAt: now },
    });
    await addRates(id, source, rates);
    existing.push({ id, name, address: cp.address?.trim() ?? '', sources: [source] });
    created++;
  }

  const activeSources = new Set(results.filter(r => r.carparks.length).map(r => r.source));
  let deactivated = 0;
  const managed = await prisma.carpark.findMany({ where: { active: true }, select: { id: true, sources: true, scrapeMisses: true } });
  for (const cp of managed) {
    if (seen.has(cp.id)) continue;
    if (!isScraperManaged(cp.sources)) continue;
    if (!cp.sources.some(s => activeSources.has(s))) continue;

    const misses = cp.scrapeMisses + 1;
    const active = misses < SCRAPER.dropAfterMisses;
    await prisma.carpark.update({ where: { id: cp.id }, data: { scrapeMisses: misses, active } });
    if (!active) { deactivated++; log.info(`deactivated stale scraped carpark ${cp.id} after ${misses} misses`); }
  }

  log.info(`scraped applied - ${matched} matched, ${created} new, ${skipped} skipped, ${deactivated} deactivated`);
}
