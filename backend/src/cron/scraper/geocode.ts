import axios from 'axios';
import { TIMEOUTS } from '../config.js';
import createLogger from '../../lib/logger.js';

const log = createLogger('geocode');

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GEOAPIFY_KEY;
  if (!key) { log.debug('GEOAPIFY_KEY missing, cannot geocode'); return null; }

  try {
    const { data } = await axios.get('https://api.geoapify.com/v1/geocode/search', {
      params: { text: query, filter: 'countrycode:sg', format: 'json', apiKey: key },
      timeout: TIMEOUTS.api,
    });
    const r = data?.results?.[0];
    if (!r || typeof r.lat !== 'number' || typeof r.lon !== 'number') return null;
    return { lat: r.lat, lng: r.lon };
  } catch {
    log.debug(`geocode failed for "${query}"`);
    return null;
  }
}
