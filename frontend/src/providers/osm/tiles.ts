import type { TileProviderConfig } from '../../types/map';

export const OSM_TILES: TileProviderConfig[] = [
  {
    id: 'carto-voyager',
    name: 'Basic',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    subdomains: ['a', 'b', 'c', 'd'],
    category: 'free',
    proxy: false,
    preview: '#e8e0d8',
  },
];
