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
  },
  {
    id: 'google-hybrid',
    name: 'Hybrid',
    url: '/api/google/tiles/hybrid/{z}/{x}/{y}',
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    category: 'google',
    proxy: true,
    preview: '#1a2e1a',
  },
  {
    id: 'google-3d',
    name: '3D Photo',
    url: '/api/google/tiles/3d/{z}/{x}/{y}',
    attribution: '&copy; Google Maps',
    maxZoom: 22,
    category: 'google',
    proxy: true,
    is3D: true,
    preview: '#4a7a6a',
  },
];
