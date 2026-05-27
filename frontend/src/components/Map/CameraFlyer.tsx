import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Carpark, DestinationPoint } from '../../types';

interface Props {
  selectedId: number | null;
  results: Carpark[];
  hasSearched: boolean;
  destinationPoint: DestinationPoint | null;
  userLocation?: [number, number] | null;
}

export function CameraFlyer({ selectedId, results, hasSearched, destinationPoint, userLocation }: Props) {
  const map = useMap();
  const hasFlownToUser = useRef(false);

  useEffect(() => {
    if (hasFlownToUser.current || !userLocation) return;
    hasFlownToUser.current = true;
    map.flyTo(userLocation, 16, {
      duration: 1.5,
      easeLinearity: 0.25,
    });
  }, [userLocation, map]);

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
