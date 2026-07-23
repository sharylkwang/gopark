import axios from 'axios';

const LYRS: Record<string, string> = { roads: 'm', hybrid: 'y', '3d': 's' };

interface TileResult {
  data: Buffer;
  contentType: string;
}

export function isValidTileType(type: string): boolean {
  return type in LYRS;
}

export async function fetchTile(type: string, z: number, x: number, y: number): Promise<TileResult> {
  const lyrs = LYRS[type];
  if (!lyrs) throw new Error(`Unknown tile type: ${type}`);

  let url = `https://mt${(x + y) % 4}.google.com/vt/lyrs=${lyrs}&x=${x}&y=${y}&z=${z}`;

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
