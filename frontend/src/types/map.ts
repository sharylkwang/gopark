export type TileCategory = 'free' | 'google' | 'mapbox' | 'onemap';

export interface TileProviderConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  category: TileCategory;
  proxy: boolean;
  is3D?: boolean;
  tileSize?: number;
  zoomOffset?: number;
  preview?: string;
}

export interface MapEventHandlers {
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  onZoomEnd?: (zoom: number) => void;
  onMoveEnd?: (center: { lat: number; lng: number }) => void;
}
