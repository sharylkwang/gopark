import { createHash } from 'crypto';
import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';
import { SCRAPER } from '../config.js';
import type { ScrapedCarpark, ScrapedResult } from '../pipeline/types.js';
import { detect, complete, parseJson } from './llm.js';
import type { Backend } from './llm.js';
import { searchWeb, fetchPage, chunkText, isSearchAvailable } from './search.js';

const log = createLogger('scraper');

const SYSTEM_MSG = 'You extract structured parking rate data from text. Output ONLY valid JSON.';
const EXTRACTION_SCHEMA = `Return JSON: { "carparks": [{ "name": "...", "address": "...", "rates": [{ "vehicle_type": "car|motorcycle|heavy_vehicle", "day_type": "weekday|saturday|sunday|public_holiday|all", "rate_text": "...", "amount_dollars": 1.20, "per_minutes": 30, "time_start": "07:00", "time_end": "17:00", "is_first_block": false }] }] }`;

function hash(data: unknown) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function extract(url: string, prompt: string, backend: Backend): Promise<ScrapedCarpark[]> {
  const content = await fetchPage(url);
  const chunks = chunkText(content);
  if (chunks.length === 1) {
    const raw = await complete(backend, SYSTEM_MSG, `${prompt}\n\n${EXTRACTION_SCHEMA}\n\nPage content:\n${chunks[0]}`);
    return (parseJson(raw).carparks as ScrapedCarpark[]) ?? [];
  }

  log.info(`${url} - splitting into ${chunks.length} chunks`);
  const all: ScrapedCarpark[] = [];
  for (const chunk of chunks) {
    const raw = await complete(backend, SYSTEM_MSG, `${prompt}\n\n${EXTRACTION_SCHEMA}\n\nPage content (chunk):\n${chunk}`);
    const parsed = (parseJson(raw).carparks as ScrapedCarpark[]) ?? [];
    all.push(...parsed);
  }

  const seen = new Set<string>();
  return all.filter(cp => {
    const key = (cp.name ?? '').toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const VERIFY_PROMPT = 'Does this page contain Singapore parking or carpark rate information? Reply ONLY with JSON: { "relevant": true/false, "reason": "one sentence" }';

async function verifyPage(url: string, backend: Backend): Promise<boolean> {
  try {
    const content = await fetchPage(url);
    const preview = content.slice(0, 3000);
    const raw = await complete(backend, 'You classify web pages. Output ONLY valid JSON.', `${VERIFY_PROMPT}\n\nPage preview:\n${preview}`);
    const result = parseJson(raw);
    const relevant = result.relevant === true;
    log.info(`verify ${url} - ${relevant ? 'relevant' : 'irrelevant'}: ${result.reason || ''}`);
    return relevant;
  } catch (e) {
    log.debug(`verify failed for ${url}: ${e}`);
    return false;
  }
}

async function cacheResult(url: string, domain: string, source: string, prompt: string, backend: Backend): Promise<ScrapedCarpark[]> {
  const carparks = await extract(url, prompt, backend);
  const h = hash(carparks);
  const now = new Date();
  const existing = await prisma.scrapedPage.findUnique({ where: { url } });

  if (existing) {
    const changed = existing.dataHash !== h;
    await prisma.scrapedPage.update({ where: { url }, data: { dataHash: h, carparks: carparks.length, lastScraped: now, ...(changed ? { lastChanged: now } : {}) } });
    log[changed ? 'info' : 'debug'](`${url} - ${changed ? 'updated' : 'unchanged'} (${carparks.length} carparks)`);
  } else {
    await prisma.scrapedPage.create({ data: { url, domain, source, dataHash: h, carparks: carparks.length, lastScraped: now, lastChanged: now } });
    log.info(`${url} - cached (${carparks.length} carparks)`);
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
  if (!isSearchAvailable()) {
    log.info('search down, skipping scraper run');
    return [];
  }

  const backend = await detect();
  if (backend === 'none') { log.warn('no LLM backend - skipping'); return []; }
  log.info(`backend: ${backend}`);

  await syncDomains();
  const staleSet = new Set(await purgeStale());
  const domains = await prisma.scraperDomain.findMany({ where: { active: true } });
  const results: ScrapedResult[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SCRAPER.recheckDays);

  for (const dom of domains) {
    if (!isSearchAvailable()) break;

    try {
      const cached = await prisma.scrapedPage.findMany({ where: { domain: dom.domain } });
      const needsSearch = !cached.length || staleSet.has(dom.domain) || !dom.lastSearched || dom.lastSearched < cutoff;
      let urls: string[];

      if (needsSearch) {
        log.info(`searching ${dom.domain}`);
        urls = (await searchWeb(dom.searchQuery)).filter(u => u.includes(dom.domain));
        if (urls.length) await prisma.scraperDomain.update({ where: { id: dom.id }, data: { lastSearched: new Date() } });
      } else {
        urls = cached.filter(p => p.lastScraped < cutoff).map(p => p.url);
        if (!urls.length) { log.debug(`${dom.domain} - fresh`); continue; }
      }

      const carparks: ScrapedCarpark[] = [];
      for (const url of urls) {
        try { carparks.push(...await cacheResult(url, dom.domain, dom.domain, dom.prompt, backend)); }
        catch (e) { log.error(`scrape failed: ${url}`, e); }
      }
      if (carparks.length) results.push({ source: dom.domain, carparks });
      log.info(`${dom.domain} - ${carparks.length} carparks`);
    } catch (e) { log.error(`domain failed: ${dom.domain}`, e); }
  }
  return results;
}

export async function smartSearch(): Promise<ScrapedResult[]> {
  if (!isSearchAvailable()) {
    log.info('search down, skipping smart search');
    return [];
  }

  const backend = await detect();
  if (backend === 'none') { log.warn('smart search skipped - no LLM'); return []; }

  const known = new Set((await prisma.scrapedPage.findMany({ select: { url: true } })).map(p => p.url));
  const rejected = new Set((await prisma.scrapedPage.findMany({ where: { carparks: 0 } })).map(p => p.url));
  log.info(`smart search - ${known.size} cached, ${rejected.size} previously rejected`);

  const found: string[] = [];
  for (const q of SCRAPER.smartQueries) {
    if (!isSearchAvailable()) break;
    try { found.push(...await searchWeb(q)); }
    catch (e) { log.warn(`search failed: ${q}`, e); }
  }

  const fresh = [...new Set(found)].filter(u => !known.has(u) && !rejected.has(u));
  if (!fresh.length) { log.info('smart search - nothing new'); return []; }
  log.info(`smart search - ${fresh.length} new candidate pages, verifying...`);

  const verified: string[] = [];
  for (const url of fresh) {
    if (!isSearchAvailable()) break;
    try {
      if (await verifyPage(url, backend)) verified.push(url);
    } catch (e) { log.debug(`verify skipped: ${url}`, e); }
  }

  if (!verified.length) {
    log.info(`smart search - 0/${fresh.length} pages verified as relevant`);
    for (const url of fresh) {
      try {
        await prisma.scrapedPage.upsert({
          where: { url },
          create: { url, domain: new URL(url).hostname, source: 'smart_search', dataHash: '', carparks: 0, lastScraped: new Date(), lastChanged: new Date() },
          update: { lastScraped: new Date() },
        });
      } catch {}
    }
    return [];
  }

  log.info(`smart search - ${verified.length}/${fresh.length} pages verified, scraping...`);

  const carparks: ScrapedCarpark[] = [];
  for (const url of verified) {
    try { carparks.push(...await cacheResult(url, new URL(url).hostname, 'smart_search', SCRAPER.defaultPrompt, backend)); }
    catch (e) { log.warn(`smart search scrape failed: ${url}`, e); }
  }

  log.info(`smart search - ${carparks.length} carparks from ${verified.length} verified pages`);
  return carparks.length ? [{ source: 'smart_search', carparks }] : [];
}
