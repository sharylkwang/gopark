import type { TileProviderConfig } from '../../types/map';

export const ONEMAP_TILES: TileProviderConfig[] = [
  {
    id: 'onemap-default',
    name: 'OneMap',
    url: 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.onemap.gov.sg">OneMap</a>',
    maxZoom: 19,
    category: 'onemap',
    proxy: false,
    preview: '#dce8d4',
    theme: 'light',
  },
];
