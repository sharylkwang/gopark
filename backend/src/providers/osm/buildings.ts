import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import createLogger from '../../lib/logger.js';

const log = createLogger('osm-buildings');

const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

interface BuildingFeature {
  type: 'Feature';
  properties: { id: number; name: string; height: number; minHeight: number };
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
}

const cache = new Map<string, { features: BuildingFeature[]; ts: number }>();
const pending = new Map<string, Promise<BuildingFeature[]>>();

let mirrorIdx = 0;
let tmpl: { url: string; ts: number } | null = null;

function tileToBbox(z: number, x: number, y: number) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);
  return { south, west, north, east };
}

async function getTemplate(): Promise<string> {
  if (tmpl && Date.now() - tmpl.ts < 3600000) return tmpl.url;
  const { data } = await axios.get('https://tiles.openfreemap.org/planet', { timeout: 12000 });
  const url = Array.isArray(data?.tiles) ? data.tiles[0] : null;
  if (typeof url !== 'string') throw new Error('no tile template in openfreemap tilejson');
  tmpl = { url, ts: Date.now() };
  return url;
}

function fromMvt(buf: ArrayBuffer, z: number, x: number, y: number): BuildingFeature[] {
  const layer = new VectorTile(new PbfReader(new Uint8Array(buf))).layers.building;
  if (!layer) return [];

  const features: BuildingFeature[] = [];
  for (let i = 0; i < layer.length; i++) {
    const feat = layer.feature(i);
    if (feat.properties.hide_3d === true) continue;

    const geojson = feat.toGeoJSON(x, y, z);
    const polygons = geojson.geometry.type === 'MultiPolygon' ? geojson.geometry.coordinates
      : geojson.geometry.type === 'Polygon' ? [geojson.geometry.coordinates] : [];

    const rawH = Number(feat.properties.render_height), rawMin = Number(feat.properties.render_min_height);
    const height = Number.isFinite(rawH) && rawH > 0 ? rawH : 10;
    const minHeight = Number.isFinite(rawMin) && rawMin > 0 && rawMin < height ? rawMin : 0;
    const baseId = typeof feat.id === 'number' ? feat.id : i;

    polygons.forEach((rings, pi) => {
      if (!rings[0] || rings[0].length < 4) return;
      features.push({
        type: 'Feature',
        properties: { id: baseId * 100 + pi, name: '', height, minHeight },
        geometry: { type: 'Polygon', coordinates: rings as [number, number][][] },
      });
    });
  }
  return features;
}

async function queryOpenFreeMap(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const template = await getTemplate();
  const url = template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  const { data } = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 12000,
    headers: { 'User-Agent': 'GoPark/1.0' },
  });
  return fromMvt(data, z, x, y);
}

function fromOverpass(elements: any[]): BuildingFeature[] {
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

async function queryOverpass(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const bbox = tileToBbox(z, x, y);
  const query = `[out:json][timeout:20];way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out geom;`;
  let lastErr: unknown = null;

  for (let i = 0; i < MIRRORS.length; i++) {
    const mirror = MIRRORS[(mirrorIdx + i) % MIRRORS.length];
    try {
      const { data } = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'GoPark/1.0',
        },
        timeout: 12000,
      });
      if (data && Array.isArray(data.elements)) {
        mirrorIdx = (mirrorIdx + i) % MIRRORS.length;
        return fromOverpass(data.elements);
      }
      lastErr = new Error(`${mirror} gave non-json body`);
    } catch (e) { lastErr = e; }
  }

  throw lastErr ?? new Error('overpass mirrors all failed');
}

async function loadTile(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const key = `${z}/${x}/${y}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < 21600000) return cached.features;

  const running = pending.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      let features: BuildingFeature[];
      try {
        features = await queryOpenFreeMap(z, x, y);
      } catch (e) {
        log.warn(`openfreemap tile ${key} failed, falling back to overpass: ${(e as Error).message}`);
        features = await queryOverpass(z, x, y);
      }

      if (cache.size >= 400) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(key, { features, ts: Date.now() });
      return features;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, task);
  return task;
}

const router = Router();

router.get('/osm/buildings/:z/:x/:y', async (req: Request, res: Response) => {
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
  if (![z, x, y].every(Number.isInteger) || z < 14 || z > 18) return res.status(400).json({ error: 'Bad tile' });

  const sourceZ = Math.min(z, 14), shift = z - sourceZ;
  const sx = x >> shift, sy = y >> shift;

  try {
    const features = await loadTile(sourceZ, sx, sy);
    res.set('Cache-Control', 'public, max-age=21600');
    res.json({ features });
  } catch (e) {
    const stale = cache.get(`${sourceZ}/${sx}/${sy}`);
    if (stale) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json({ features: stale.features, stale: true });
    }

    log.warn(`building tile ${sourceZ}/${sx}/${sy} failed`, e);
    res.status(503).json({ error: 'building data unavailable' });
  }
});

export default router;
