import axios from 'axios';
import { SCRAPER, TIMEOUTS } from '../config.js';
import createLogger from '../../lib/logger.js';

const log = createLogger('search');

let searchDown = false;
let searchDownSince = 0;
const COOLDOWN = 6 * 60 * 60 * 1000;

export function isSearchAvailable(): boolean {
  if (!searchDown) return true;
  if (Date.now() - searchDownSince > COOLDOWN) {
    searchDown = false;
    log.info('search cooldown expired, retrying');
    return true;
  }
  return false;
}

const BACKOFF_CODES = new Set(['ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND']);
const BACKOFF_STATUSES = new Set([403, 429, 500, 502, 503]);

// DuckDuckGo blocks/rate-limits with an HTTP status (403/429), not a socket error, so the old
// code-only check kept hammering it across every domain in the loop. Treat both as "down".
export function shouldBackOff(e: unknown): boolean {
  const err = e as { code?: string; response?: { status?: number } };
  if (err.code && BACKOFF_CODES.has(err.code)) return true;
  return err.response?.status != null && BACKOFF_STATUSES.has(err.response.status);
}

function describeSearchError(e: unknown): string {
  const err = e as { code?: string; response?: { status?: number } };
  return err.code ?? (err.response?.status != null ? `HTTP ${err.response.status}` : 'unknown');
}

const REDIRECT_HOSTS = ['duckduckgo.com', 'google.com/url', 'bing.com'];

// DuckDuckGo's HTML results wrap every target in a redirect link:
//   href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fx&rut=..."
// so the real URL is the url-encoded `uddg` parameter, not a bare href. Pull those out first,
// then fall back to any direct external https links the page might also carry.
export function extractResultUrls(html: string): string[] {
  const urls: string[] = [];

  for (const m of html.matchAll(/[?&]uddg=([^&"']+)/g)) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (decoded.startsWith('http')) urls.push(decoded);
    } catch { /* skip malformed escape sequences */ }
  }

  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (!REDIRECT_HOSTS.some(h => url.includes(h))) urls.push(url);
  }

  return [...new Set(urls)];
}

export async function searchWeb(query: string): Promise<string[]> {
  if (!isSearchAvailable()) return [];

  try {
    const { data } = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: TIMEOUTS.scrapeSearch,
    });
    searchDown = false;
    return extractResultUrls(data as string).slice(0, SCRAPER.maxSearchResults);
  } catch (e) {
    if (shouldBackOff(e)) {
      searchDown = true;
      searchDownSince = Date.now();
      log.warn(`search unavailable (${describeSearchError(e)}), backing off for 6 hours`);
    }
    throw e;
  }
}

export async function fetchPage(url: string): Promise<string> {
  const { data } = await axios.get(url, { timeout: TIMEOUTS.scrapeFetch });
  return (data as string)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SCRAPER.maxPageContentChars);
}

export function chunkText(text: string): string[] {
  if (text.length <= SCRAPER.chunkSize) return [text];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + SCRAPER.chunkSize));
    offset += SCRAPER.chunkSize - SCRAPER.chunkOverlap;
  }
  return chunks;
}
