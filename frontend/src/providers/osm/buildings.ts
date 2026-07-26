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

export function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

const TILE_ZOOM = 14;

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

const MAX_TILES_PER_VIEW = 9;

export function getTilesForBounds(bounds: { north: number; south: number; east: number; west: number }) {
  const tiles: { x: number; y: number }[] = [];
  const nw = lngLatToTile(bounds.west, bounds.north, TILE_ZOOM);
  const se = lngLatToTile(bounds.east, bounds.south, TILE_ZOOM);

  const cx = (nw.x + se.x) / 2;
  const cy = (nw.y + se.y) / 2;

  for (let x = nw.x; x <= se.x; x++) for (let y = nw.y; y <= se.y; y++) tiles.push({ x, y });

  tiles.sort((a, b) => (a.x - cx) ** 2 + (a.y - cy) ** 2 - ((b.x - cx) ** 2 + (b.y - cy) ** 2));

  return { z: TILE_ZOOM, tiles: tiles.slice(0, MAX_TILES_PER_VIEW) };
}

export async function fetchBuildingTile(z: number, x: number, y: number): Promise<BuildingFeature[]> {
  const key = `${z}/${x}/${y}`;

  const mem = memCache.get(key);
  if (mem) return mem;

  const stored = loadFromStorage(key);
  if (stored) return stored;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`/api/osm/buildings/${z}/${x}/${y}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`building tile ${key} -> ${res.status}`);

    const data = await res.json();
    const features: BuildingFeature[] = (data.features ?? []).map((f: any) => ({
      ...f,
      properties: { ...f.properties, color: '#ececec', roofColor: '#dedede' },
    }));

    memCache.set(key, features);
    saveToStorage(key, features);
    return features;
  } finally {
    clearTimeout(timer);
  }
}
