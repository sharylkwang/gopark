import type { TileProviderConfig } from '../../types/map';

export const GOOGLE_TILES: TileProviderConfig[] = [
  {
    id: 'google-roads',
    name: 'Roads',
    url: '/api/google/tiles/roads/{z}/{x}/{y}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    category: 'google',
    proxy: true,
    preview: '#f0ede8',
    theme: 'light',
  },
  {
    id: 'google-hybrid',
    name: 'Satellite',
    url: '/api/google/tiles/hybrid/{z}/{x}/{y}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    category: 'google',
    proxy: true,
    preview: '#1a2e1a',
    theme: 'any',
  },
];
