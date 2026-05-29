import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export function SingaporeBoundary() {
  const map = useMap();
  const [layer, setLayer] = useState<L.GeoJSON | null>(null);

  useEffect(() => {
    fetch('/singapore-boundary.geojson')
      .then(r => r.json())
      .then(data => {
        const geo = L.geoJSON(data, {
          style: {
            color: '#6b7280',
            weight: 1.5,
            fillOpacity: 0,
            dashArray: '6 4',
            opacity: 0.6,
          },
          interactive: false,
        });
        geo.addTo(map);
        setLayer(geo);
      })
      .catch(() => {});

    return () => { if (layer) map.removeLayer(layer); };
  }, [map]);

  return null;
}
