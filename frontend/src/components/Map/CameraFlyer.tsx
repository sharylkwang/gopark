import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Carpark, DestinationPoint } from '../../types';

interface Props {
  selectedId: number | null;
  results: Carpark[];
  hasSearched: boolean;
  destinationPoint: DestinationPoint | null;
}

export function CameraFlyer({ selectedId, results, hasSearched, destinationPoint }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!hasSearched) return;

    if (destinationPoint) {
      map.flyTo([destinationPoint.lat, destinationPoint.lng], 16, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
      return;
    }

    if (selectedId) {
      const target = results.find((cp) => cp.id === selectedId);
      if (target) {
        map.flyTo([target.lat, target.lng], 16, {
          duration: 1.5,
          easeLinearity: 0.25,
        });
      }
    }
  }, [selectedId, results, map, hasSearched, destinationPoint]);

  return null;
}
