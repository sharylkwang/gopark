import geoapifyClient from '../../lib/geoapifyClient';
import createLogger from '../../lib/logger.js';

const log = createLogger('geocode');

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!process.env.GEOAPIFY_KEY) { log.debug('GEOAPIFY_KEY missing, cannot geocode'); return null; }

  try {
    const { data } = await geoapifyClient.get('/search', {
      params: { text: query },
    });
    const r = data?.results?.[0];
    if (!r || typeof r.lat !== 'number' || typeof r.lon !== 'number') return null;
    return { lat: r.lat, lng: r.lon };
  } catch {
    log.debug(`geocode failed for "${query}"`);
    return null;
  }
}
