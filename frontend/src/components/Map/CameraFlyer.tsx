import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { CarparkSummary, DestinationPoint } from '../../types';

interface Props {
  selectedId: string | null;
  results: CarparkSummary[];
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

    if (selectedId) {
      const target = results.find((cp) => cp.id === selectedId);
      if (target) {
        map.panTo([target.lat, target.lng], { animate: true, duration: 0.5 });
      }
      return;
    }

    if (destinationPoint) {
      map.flyTo([destinationPoint.lat, destinationPoint.lng], 15, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [selectedId, results, map, hasSearched, destinationPoint]);

  return null;
}