import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export function SingaporeBoundary() {
  const map = useMap();

  useEffect(() => {
    let layer: L.GeoJSON | null = null, gone = false;
    fetch('/singapore-boundary.geojson')
      .then(r => r.json())
      .then(data => {
        if (gone) return;
        layer = L.geoJSON(data, {
          style: { color: '#6b7280', weight: 1.5, fillOpacity: 0, dashArray: '6 4', opacity: 0.6 },
          interactive: false,
        });
        layer.addTo(map);
      })
      .catch(() => {});

    return () => { gone = true; if (layer) map.removeLayer(layer); };
  }, [map]);

  return null;
}
