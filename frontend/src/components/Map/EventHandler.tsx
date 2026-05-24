import { useMapEvents } from 'react-leaflet';
import type { MapEventHandlers } from '../../types/map';

export function EventHandler({ onMapClick, onZoomEnd, onMoveEnd }: MapEventHandlers) {
  useMapEvents({
    click: (e) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    zoomend: (e) => onZoomEnd?.(e.target.getZoom()),
    moveend: (e) => {
      const center = e.target.getCenter();
      onMoveEnd?.({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}
