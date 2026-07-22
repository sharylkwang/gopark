import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import createLogger from '../../lib/logger.js';

const log = createLogger('osm-buildings');

const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

const OPENFREEMAP_TILEJSON = 'https://tiles.openfreemap.org/planet';
const SOURCE_ZOOM = 14;

const MIRROR_TIMEOUT_MS = 12000;
const TILE_TIMEOUT_MS = 12000;
const CACHE_TTL = 6 * 60 * 60 * 1000;
const TEMPLATE_TTL = 60 * 60 * 1000;
const MAX_CACHED_TILES = 400;
const DEFAULT_HEIGHT = 10;

interface BuildingFeature {
  type: 'Feature';
  properties: { id: number; name: string; height: number; minHeight: number };
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
}

const cache = new Map<string, { features: BuildingFeature[]; ts: number }>();
const inFlight = new Map<string, Promise<BuildingFeature[]>>();

let mirrorCursor = 0;
let tileTemplate: { url: string; ts: number } | null = null;

function tileToBbox(z: number, x: number, y: number) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);
  return { south, west, north, east };
}

async function openFreeMapTemplate(): Promise<string> {
  if (tileTemplate && Date.now() - tileTemplate.ts < TEMPLATE_TTL) return tileTemplate.url;

  const { data } = await axios.get(OPENFREEMAP_TILEJSON, { timeout: TILE_TIMEOUT_MS });
  const url = Array.isArray(data?.tiles) ? data.tiles[0] : null;
  if (typeof url !== 'string') throw new Error('OpenFreeMap TileJSON has no tile template');

  tileTemplate = { url, ts: Date.now() };
  return url;
}

function toFeaturesFromMvt(buf: ArrayBuffer, z: number, x: number, y: number): BuildingFeature[] {
  const layer = new VectorTile(new PbfReader(new Uint8Array(buf))).layers.building;
  if (!layer) return [];

  const features: BuildingFeature[] = [];

  for (let i = 0; i < layer.length; i++) {
    const feat = layer.feature(i);
    if (feat.properties.hide_3d === true) continue;

    const geojson = feat.toGeoJSON(x, y, z);
    const polygons = geojson.geometry.type === 'MultiPolygon' ? geojson.geometry.coordinates
      : geojson.geometry.type === 'Polygon' ? [geojson.geometry.coordinates] : [];

    const rawHeight = Number(feat.properties.render_height), rawMin = Number(feat.properties.render_min_height);
    const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : DEFAULT_HEIGHT;
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
  const template = await openFreeMapTemplate();
  const url = template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

  const { data } = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: TILE_TIMEOUT_MS,
    headers: { 'User-Agent': 'GoPark/1.0' },
  });

  return toFeaturesFromMvt(data, z, x, y);
}

function toFeaturesFromOverpass(elements: any[]): BuildingFeature[] {
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
        return toFeaturesFromOverpass(data.elements);
      }
      lastError = new Error(`${mirror} returned a non-JSON body`);
    } catch (e) { lastError = e; }
  }

  throw lastError ?? new Error('All Overpass mirrors unreachable');
}

async function loadTile(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const key = `${z}/${x}/${y}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.features;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      let features: BuildingFeature[];
      try {
        features = await queryOpenFreeMap(z, x, y);
      } catch (openFreeMapError) {
        log.warn(`OpenFreeMap tile ${key} failed, trying Overpass: ${openFreeMapError instanceof Error ? openFreeMapError.message : openFreeMapError}`);
        features = await queryOverpass(z, x, y);
      }

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
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
  if (![z, x, y].every(Number.isInteger) || z < 14 || z > 18) return res.status(400).json({ error: 'Bad tile' });

  const sourceZ = Math.min(z, SOURCE_ZOOM), shift = z - sourceZ;
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

    log.warn(`building tile ${sourceZ}/${sx}/${sy} failed: ${e instanceof Error ? e.message : e}`);
    res.status(503).json({ error: 'Building data is not responding' });
  }
});

export default router;
