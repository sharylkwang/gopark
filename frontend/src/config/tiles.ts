import type { TileProviderConfig } from '../types/map';

export const TILE_PROVIDERS: TileProviderConfig[] = [
  {
    id: 'carto-voyager',
    name: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
    category: 'free',
    proxy: false,
    preview: '#e8e0d8',
  },
  {
    id: 'osm',
    name: 'OSM 3D',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    category: 'free',
    proxy: false,
    is3D: true,
    preview: '#aad3a5',
  },
  {
    id: 'google-roads',
    name: 'Roads',
    url: '/api/tiles/google-roads/{z}/{x}/{y}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    category: 'google',
    proxy: true,
    preview: '#f0ede8',
  },
  {
    id: 'google-hybrid',
    name: 'Hybrid',
    url: '/api/tiles/google-hybrid/{z}/{x}/{y}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    category: 'google',
    proxy: true,
    preview: '#1a2e1a',
  },
  {
    id: 'google-3d',
    name: '3D Photo',
    url: '',
    attribution: '&copy; Google Maps',
    maxZoom: 22,
    category: 'google',
    proxy: false,
    is3D: true,
    preview: '#4a7a6a',
  },
  {
    id: 'onemap-default',
    name: 'OneMap',
    url: 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.onemap.gov.sg">OneMap</a>',
    maxZoom: 19,
    category: 'onemap',
    proxy: false,
    preview: '#dce8d4',
  },
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
