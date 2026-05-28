import { createHash } from 'crypto';
import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';
import { SCRAPER } from '../config.js';
import type { ScrapedCarpark, ScrapedResult } from '../pipeline/types.js';
import { detect, complete, parseJson } from './llm.js';
import type { Backend } from './llm.js';
import { searchWeb, fetchPage } from './search.js';

const log = createLogger('scraper');

const SYSTEM_MSG = 'You extract structured parking rate data from text. Output ONLY valid JSON.';

const EXTRACTION_SCHEMA = `Return JSON: { "carparks": [{ "name": "...", "address": "...", "rates": [{ "vehicle_type": "car|motorcycle|heavy_vehicle", "day_type": "weekday|saturday|sunday|public_holiday|all", "rate_text": "...", "amount_dollars": 1.20, "per_minutes": 30, "time_start": "07:00", "time_end": "17:00", "is_first_block": false }] }] }`;

function hash(data: unknown) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function extract(url: string, prompt: string, backend: Backend): Promise<ScrapedCarpark[]> {
  const content = await fetchPage(url);
  const raw = await complete(backend, SYSTEM_MSG, `${prompt}\n\n${EXTRACTION_SCHEMA}\n\nPage content:\n${content}`);
  return (parseJson(raw).carparks as ScrapedCarpark[]) ?? [];
}

async function cache(url: string, domain: string, source: string, prompt: string, backend: Backend): Promise<ScrapedCarpark[]> {
  const carparks = await extract(url, prompt, backend);
  const h = hash(carparks);
  const now = new Date();
  const existing = await prisma.scrapedPage.findUnique({ where: { url } });

  if (existing) {
    const changed = existing.dataHash !== h;
    await prisma.scrapedPage.update({ where: { url }, data: { dataHash: h, carparks: carparks.length, lastScraped: now, ...(changed ? { lastChanged: now } : {}) } });
    log[changed ? 'info' : 'debug'](`${url} — ${changed ? 'updated' : 'unchanged'} (${carparks.length} carparks)`);
  } else {
    await prisma.scrapedPage.create({ data: { url, domain, source, dataHash: h, carparks: carparks.length, lastScraped: now, lastChanged: now } });
    log.info(`${url} — cached (${carparks.length} carparks)`);
  }
  return carparks;
}

async function purgeStale(): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - SCRAPER.staleMonths);
  const stale = await prisma.scrapedPage.findMany({ where: { lastChanged: { lt: cutoff } } });
  if (stale.length) {
    log.warn(`purging ${stale.length} stale pages`);
    await prisma.scrapedPage.deleteMany({ where: { id: { in: stale.map(p => p.id) } } });
  }
  return stale.map(p => p.domain);
}

async function syncDomains() {
  for (const d of SCRAPER.domains) {
    await prisma.scraperDomain.upsert({
      where: { domain: d.domain },
      update: { searchQuery: d.searchQuery, prompt: d.prompt },
      create: { domain: d.domain, searchQuery: d.searchQuery, prompt: d.prompt },
    });
  }
}

export async function runScraper(): Promise<ScrapedResult[]> {
  const backend = await detect();
  if (backend === 'none') { log.warn('no LLM backend — skipping'); return []; }
  log.info(`backend: ${backend}`);

  await syncDomains();
  const staleSet = new Set(await purgeStale());
  const domains = await prisma.scraperDomain.findMany({ where: { active: true } });
  const results: ScrapedResult[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SCRAPER.recheckDays);

  for (const dom of domains) {
    try {
      const cached = await prisma.scrapedPage.findMany({ where: { domain: dom.domain } });
      const needsSearch = !cached.length || staleSet.has(dom.domain) || !dom.lastSearched || dom.lastSearched < cutoff;
      let urls: string[];

      if (needsSearch) {
        log.info(`searching ${dom.domain}`);
        urls = (await searchWeb(dom.searchQuery)).filter(u => u.includes(dom.domain));
        await prisma.scraperDomain.update({ where: { id: dom.id }, data: { lastSearched: new Date() } });
      } else {
        urls = cached.filter(p => p.lastScraped < cutoff).map(p => p.url);
        if (!urls.length) { log.debug(`${dom.domain} — fresh`); continue; }
      }

      const carparks: ScrapedCarpark[] = [];
      for (const url of urls) {
        try { carparks.push(...await cache(url, dom.domain, dom.domain, dom.prompt, backend)); }
        catch (e) { log.error(`scrape failed: ${url}`, e); }
      }
      if (carparks.length) results.push({ source: dom.domain, carparks });
      log.info(`${dom.domain} — ${carparks.length} carparks`);
    } catch (e) { log.error(`domain failed: ${dom.domain}`, e); }
  }
  return results;
}

export async function smartSearch(): Promise<ScrapedResult[]> {
  const backend = await detect();
  if (backend === 'none') { log.warn('smart search skipped — no LLM'); return []; }

  const known = new Set((await prisma.scrapedPage.findMany({ select: { url: true } })).map(p => p.url));
  log.info(`smart search — ${known.size} cached URLs`);

  const found: string[] = [];
  for (const q of SCRAPER.smartQueries) {
    try { found.push(...await searchWeb(q)); }
    catch (e) { log.warn(`search failed: ${q}`, e); }
  }

  const fresh = [...new Set(found)].filter(u => !known.has(u));
  if (!fresh.length) { log.info('smart search — nothing new'); return []; }
  log.info(`smart search — ${fresh.length} new pages`);

  const carparks: ScrapedCarpark[] = [];
  for (const url of fresh) {
    try { carparks.push(...await cache(url, new URL(url).hostname, 'smart_search', SCRAPER.defaultPrompt, backend)); }
    catch (e) { log.warn(`smart search failed: ${url}`, e); }
  }

  log.info(`smart search — ${carparks.length} carparks from ${fresh.length} pages`);
  return carparks.length ? [{ source: 'smart_search', carparks }] : [];
}
