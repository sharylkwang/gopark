import axios from 'axios';

interface ProxyConfig {
  buildUrl: (z: number, x: number, y: number) => string;
}

const TILE_TYPES: Record<string, ProxyConfig> = {
  roads: {
    buildUrl: (z, x, y) => `https://mt${(x + y) % 4}.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`,
  },
  hybrid: {
    buildUrl: (z, x, y) => `https://mt${(x + y) % 4}.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`,
  },
  '3d': {
    buildUrl: (z, x, y) => `https://mt${(x + y) % 4}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`,
  },
};

interface TileResult {
  data: Buffer;
  contentType: string;
}

export function isValidTileType(type: string): boolean {
  return type in TILE_TYPES;
}

export async function fetchTile(type: string, z: number, x: number, y: number): Promise<TileResult> {
  const config = TILE_TYPES[type];
  if (!config) throw new Error(`Unknown tile type: ${type}`);

  let url = config.buildUrl(z, x, y);

  const key = process.env.GOOGLE_MAPS_KEY;
  if (key) url += `&key=${key}`;

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 10000,
    headers: { 'User-Agent': 'GoPark/1.0' },
  });

  return {
    data: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'image/png',
  };
}
