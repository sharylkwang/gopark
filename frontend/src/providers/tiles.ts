import type { TileProviderConfig } from '../types/map';
import { GOOGLE_TILES } from './google';
import { OSM_TILES } from './osm';
import { ONEMAP_TILES } from './onemap';

export const TILE_PROVIDERS: TileProviderConfig[] = [
  ...ONEMAP_TILES,
  ...GOOGLE_TILES,
  ...OSM_TILES,
];

export const DEFAULT_TILE = 'google-roads';

export function getTileProvider(id: string): TileProviderConfig | undefined {
  return TILE_PROVIDERS.find((p) => p.id === id);
}

export function getPreviewUrl(tile: TileProviderConfig, lat: number, lng: number, zoom: number): string | null {
  if (!tile.url) return null;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return tile.url
    .replace('{s}', tile.subdomains?.[0] ?? '')
    .replace('{z}', String(zoom))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', '');
}
