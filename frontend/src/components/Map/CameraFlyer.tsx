import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { CarparkSummary, DestinationPoint } from '../../types';

interface Props {
  selectedId: string | null;
  results: CarparkSummary[];
  hasSearched: boolean;
  destinationPoint: DestinationPoint | null;
  userLocation?: [number, number] | null;
  compact?: boolean;
}

const ZOOM = {
  desktop: { user: 16, carpark: 16, destination: 15, threshold: 15 },
  compact: { user: 17, carpark: 17, destination: 16, threshold: 16 },
};

export function CameraFlyer({ selectedId, results, hasSearched, destinationPoint, userLocation, compact = false }: Props) {
  const map = useMap();
  const hasFlownToUser = useRef(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const zoom = compact ? ZOOM.compact : ZOOM.desktop;

  useEffect(() => {
    if (hasFlownToUser.current || !userLocation) return;
    hasFlownToUser.current = true;
    map.flyTo(userLocation, zoom.user, {
      duration: 1.5,
      easeLinearity: 0.25,
    });
  }, [userLocation, map, zoom.user]);

  useEffect(() => {
    if (!hasSearched) return;

    if (selectedId) {
      const target = resultsRef.current.find((cp) => cp.id === selectedId);
      if (target) {
        if (map.getZoom() < zoom.threshold) {
          map.flyTo([target.lat, target.lng], zoom.carpark, { duration: 1, easeLinearity: 0.25 });
        } else {
          map.panTo([target.lat, target.lng], { animate: true, duration: 0.5 });
        }
      }
      return;
    }

    if (destinationPoint) {
      map.flyTo([destinationPoint.lat, destinationPoint.lng], zoom.destination, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [selectedId, map, hasSearched, destinationPoint?.lat, destinationPoint?.lng, zoom]);

  return null;
}