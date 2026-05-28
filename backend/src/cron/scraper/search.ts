import axios from 'axios';
import { SCRAPER, TIMEOUTS } from '../config.js';

export async function searchWeb(query: string): Promise<string[]> {
  const { data } = await axios.get('https://html.duckduckgo.com/html/', {
    params: { q: query },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: TIMEOUTS.scrapeSearch,
  });
  const urls: string[] = [];
  for (const m of (data as string).matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const url = m[1];
    if (!url.includes('duckduckgo') && !url.includes('google.com/url')) urls.push(url);
  }
  return [...new Set(urls)].slice(0, SCRAPER.maxSearchResults);
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
