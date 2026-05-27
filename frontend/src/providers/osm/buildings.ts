export interface BuildingFeature {
  type: 'Feature';
  properties: {
    id: number;
    name: string;
    height: number;
    minHeight: number;
    color: string;
    roofColor: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

export interface BuildingCollection {
  type: 'FeatureCollection';
  features: BuildingFeature[];
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

function tileToBbox(z: number, x: number, y: number) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * (180 / Math.PI);
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * (180 / Math.PI);
  return { south, west, north, east };
}

function toGeoJson(data: { elements: OverpassElement[] }): BuildingCollection {
  const nodes: Record<number, [number, number]> = {};
  const features: BuildingFeature[] = [];

  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      nodes[el.id] = [el.lon, el.lat];
    }
  }

  for (const el of data.elements) {
    if (el.type === 'way' && el.tags?.building && el.nodes) {
      const coords = el.nodes.map((nid) => nodes[nid]).filter(Boolean);
      if (coords.length >= 3) {
        const levels = parseFloat(el.tags['building:levels'] || '0');
        features.push({
          type: 'Feature',
          properties: {
            id: el.id,
            name: el.tags.name || '',
            height: parseFloat(el.tags.height || '0') || levels * 3 || 12,
            minHeight: parseFloat(el.tags.min_height || '0'),
            color: '#ececec',
            roofColor: '#dedede',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

export function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

const TILE_ZOOM = 14;

let requestQueue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = requestQueue.then(fn, fn);
  requestQueue = task.then(
    () => {},
    () => {},
  );
  return task;
}

async function queryOverpassOnce(query: string): Promise<any> {
  const body = `data=${encodeURIComponent(query)}`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, { method: 'POST', headers, body });
      if (response.ok) return response.json();
    } catch {}
  }

  return null;
}

async function queryOverpass(query: string): Promise<any> {
  return enqueue(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = await queryOverpassOnce(query);
      if (result) return result;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
    throw new Error('All Overpass mirrors unreachable');
  });
}

const memCache = new Map<string, BuildingFeature[]>();

function loadFromStorage(key: string): BuildingFeature[] | null {
  try {
    const raw = localStorage.getItem(`osm_tile_${key}`);
    if (raw) {
      const features = JSON.parse(raw) as BuildingFeature[];
      memCache.set(key, features);
      return features;
    }
  } catch {}
  return null;
}

function saveToStorage(key: string, features: BuildingFeature[]) {
  try {
    localStorage.setItem(`osm_tile_${key}`, JSON.stringify(features));
  } catch {}
}

export function getTilesForBounds(bounds: { north: number; south: number; east: number; west: number }) {
  const tiles: { x: number; y: number }[] = [];
  const nw = lngLatToTile(bounds.west, bounds.north, TILE_ZOOM);
  const se = lngLatToTile(bounds.east, bounds.south, TILE_ZOOM);
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      tiles.push({ x, y });
    }
  }
  return { z: TILE_ZOOM, tiles };
}

export async function fetchBuildingTile(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const key = `${z}/${x}/${y}`;

  const mem = memCache.get(key);
  if (mem) return mem;

  const stored = loadFromStorage(key);
  if (stored) return stored;

  const bbox = tileToBbox(z, x, y);
  const query = `[out:json][timeout:30];(way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}););out body;>;out skel qt;`;

  const data = await queryOverpass(query);
  const geojson = toGeoJson(data);
  memCache.set(key, geojson.features);
  saveToStorage(key, geojson.features);
  return geojson.features;
}
