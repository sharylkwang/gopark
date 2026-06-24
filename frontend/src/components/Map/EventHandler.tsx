import { useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import type { MapEventHandlers } from '../../types/map';

export function EventHandler({ onMapClick, onZoomEnd, onMoveEnd }: MapEventHandlers) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMapEvents({
    click: (e) => {
      if (!onMapClick) return;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        clickTimer.current = null;
      }, 300);
    },
    dblclick: () => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    },
    zoomend: (e) => onZoomEnd?.(e.target.getZoom()),
    moveend: (e) => {
      const center = e.target.getCenter();
      onMoveEnd?.({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}
