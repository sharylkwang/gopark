import type { TileProviderConfig } from '../types/map';
import { GOOGLE_TILES } from './google';
import { OSM_TILES } from './osm';
import { ONEMAP_TILES } from './onemap';

export const TILE_PROVIDERS: TileProviderConfig[] = [
  ...OSM_TILES,
  ...GOOGLE_TILES,
  ...ONEMAP_TILES,
];

export const DEFAULT_TILE = 'onemap-default';

export function getTileProvider(id: string): TileProviderConfig | undefined {
  return TILE_PROVIDERS.find((p) => p.id === id);
}

const PREVIEW_Z = 11;
const PREVIEW_X = 1614;
const PREVIEW_Y = 1020;

export function getPreviewUrl(tile: TileProviderConfig): string | null {
  if (!tile.url) return null;
  return tile.url
    .replace('{s}', tile.subdomains?.[0] ?? '')
    .replace('{z}', String(PREVIEW_Z))
    .replace('{x}', String(PREVIEW_X))
    .replace('{y}', String(PREVIEW_Y))
    .replace('{r}', '');
}
