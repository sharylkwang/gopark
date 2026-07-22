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
  routePolyline?: [number, number][] | null;
  sidebarOpen?: boolean;
}

const ZOOM = {
  desktop: { user: 16, carpark: 16, destination: 15, threshold: 15 },
  compact: { user: 17, carpark: 17, destination: 16, threshold: 16 },
};

export function CameraFlyer({ selectedId, results, hasSearched, destinationPoint, userLocation, compact = false, routePolyline, sidebarOpen = true }: Props) {
  const map = useMap();
  const hasFlownToUser = useRef(false);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const zoom = compact ? ZOOM.compact : ZOOM.desktop;

  const routeKey = routePolyline && routePolyline.length > 1
    ? `${routePolyline.length}:${routePolyline[0].join()}:${routePolyline[routePolyline.length - 1].join()}`
    : '';

  useEffect(() => {
    if (!routePolyline || routePolyline.length < 2) return;
    const paddingTopLeft: [number, number] = compact ? [40, 150] : [sidebarOpen ? 380 : 40, 70];
    const paddingBottomRight: [number, number] = compact ? [40, 260] : [70, 70];
    map.fitBounds(routePolyline as [number, number][], { paddingTopLeft, paddingBottomRight, maxZoom: 17 });
  }, [routeKey, map, compact, sidebarOpen]);

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
      if (routePolyline && routePolyline.length > 1) return;
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
  }, [selectedId, map, hasSearched, destinationPoint?.lat, destinationPoint?.lng, zoom, routeKey]);

  return null;
}