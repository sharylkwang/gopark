import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('osm-buildings');

const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

const MIRROR_TIMEOUT_MS = 12000;
const CACHE_TTL = 6 * 60 * 60 * 1000;
const MAX_CACHED_TILES = 400;

interface BuildingFeature {
  type: 'Feature';
  properties: { id: number; name: string; height: number; minHeight: number };
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
}

const cache = new Map<string, { features: BuildingFeature[]; ts: number }>();
const inFlight = new Map<string, Promise<BuildingFeature[]>>();

let mirrorCursor = 0;

function tileToBbox(z: number, x: number, y: number) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);
  return { south, west, north, east };
}

// `out geom` returns each way's coordinates inline, so Overpass never has to resolve and ship the
// node table separately. It is markedly cheaper than `out body;>;out skel qt;` for the same data.
function toFeatures(elements: any[]): BuildingFeature[] {
  const features: BuildingFeature[] = [];

  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || !el.tags?.building) continue;

    const coords = el.geometry
      .filter((pt: any) => typeof pt?.lat === 'number' && typeof pt?.lon === 'number')
      .map((pt: any) => [pt.lon, pt.lat] as [number, number]);
    if (coords.length < 3) continue;

    const levels = parseFloat(el.tags['building:levels'] || '0');
    features.push({
      type: 'Feature',
      properties: {
        id: el.id,
        name: el.tags.name || '',
        height: parseFloat(el.tags.height || '0') || levels * 3 || 12,
        minHeight: parseFloat(el.tags.min_height || '0'),
      },
      geometry: { type: 'Polygon', coordinates: [coords] },
    });
  }

  return features;
}

async function queryOverpass(query: string): Promise<any[]> {
  let lastError: unknown = null;

  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    const mirror = OVERPASS_MIRRORS[(mirrorCursor + i) % OVERPASS_MIRRORS.length];

    try {
      const { data } = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'GoPark/1.0',
        },
        timeout: MIRROR_TIMEOUT_MS,
      });

      if (data && Array.isArray(data.elements)) {
        mirrorCursor = (mirrorCursor + i) % OVERPASS_MIRRORS.length;
        return data.elements;
      }
      lastError = new Error(`${mirror} returned a non-JSON body`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error('All Overpass mirrors unreachable');
}

async function loadTile(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const key = `${z}/${x}/${y}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.features;

  // Many clients ask for the same tiles: collapse concurrent requests into one upstream call.
  const pending = inFlight.get(key);
  if (pending) return pending;

  const bbox = tileToBbox(z, x, y);
  const query = `[out:json][timeout:20];way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out geom;`;

  const task = (async () => {
    try {
      const features = toFeatures(await queryOverpass(query));

      if (cache.size >= MAX_CACHED_TILES) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(key, { features, ts: Date.now() });
      return features;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

const router = Router();

router.get('/osm/buildings/:z/:x/:y', async (req: Request, res: Response) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);

  if (![z, x, y].every(Number.isInteger) || z < 14 || z > 18) {
    return res.status(400).json({ error: 'Bad tile' });
  }

  try {
    const features = await loadTile(z, x, y);
    res.set('Cache-Control', 'public, max-age=21600');
    res.json({ features });
  } catch (e) {
    // Overpass is down: an expired tile still draws a correct city, so serve it rather than nothing.
    const stale = cache.get(`${z}/${x}/${y}`);
    if (stale) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json({ features: stale.features, stale: true });
    }

    log.warn(`building tile ${z}/${x}/${y} failed: ${e instanceof Error ? e.message : e}`);
    res.status(503).json({ error: 'OpenStreetMap is not responding' });
  }
});

export default router;
