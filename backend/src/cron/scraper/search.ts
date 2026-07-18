import axios from 'axios';
import { SCRAPER, TIMEOUTS } from '../config.js';
import createLogger from '../../lib/logger.js';

const log = createLogger('search');

let downUntil = 0;

export function isSearchAvailable(): boolean {
  if (!downUntil) return true;
  if (Date.now() < downUntil) return false;
  downUntil = 0;
  log.info('search cooldown over, trying again');
  return true;
}

const backoffCodes = ['ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'], backoffStatuses = [403, 429, 500, 502, 503];

export function shouldBackOff(e: unknown): boolean {
  const err = e as { code?: string; response?: { status?: number } };
  if (err.code && backoffCodes.includes(err.code)) return true;
  return err.response?.status != null && backoffStatuses.includes(err.response.status);
}

function describeError(e: unknown): string {
  const err = e as { code?: string; response?: { status?: number } };
  return err.code ?? (err.response?.status != null ? `HTTP ${err.response.status}` : 'unknown');
}

export function extractResultUrls(html: string): string[] {
  const urls: string[] = [];

  for (const m of html.matchAll(/[?&]uddg=([^&"']+)/g)) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (decoded.startsWith('http')) urls.push(decoded);
    } catch {}
  }

  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (!url.includes('duckduckgo.com') && !url.includes('google.com/url') && !url.includes('bing.com')) urls.push(url);
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
    downUntil = 0;
    return extractResultUrls(data as string).slice(0, SCRAPER.maxSearchResults);
  } catch (e) {
    if (shouldBackOff(e)) {
      downUntil = Date.now() + 6 * 60 * 60 * 1000;
      log.warn(`search dead (${describeError(e)}), backing off 6h`);
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
