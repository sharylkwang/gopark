import { useState } from 'react';
import { getRoute, type RouteResult } from '../providers/google/routing';
import { getWalkRoute } from '../providers/onemap/routing';
import { decodePolyline } from '../utils/decodePolyline';
import type { DestinationPoint, CarparkSummary } from '../types';

export function useRoutes(startCoords: [number, number] | null, userLocation: [number, number] | null) {
  const [driveRoute, setDriveRoute] = useState<RouteResult | null>(null);
  const [drivePolyline, setDrivePolyline] = useState<[number, number][] | null>(null);
  const [walkRoute, setWalkRoute] = useState<RouteResult | null>(null);
  const [walkPolyline, setWalkPolyline] = useState<[number, number][] | null>(null);

  const clearRoutes = () => {
    setDriveRoute(null); setDrivePolyline(null);
    setWalkRoute(null); setWalkPolyline(null);
  };

  const fetchRoutes = async (carpark: CarparkSummary, dest: DestinationPoint, originOverride?: [number, number]) => {
    const origin = originOverride || startCoords || userLocation;
    if (origin) {
      try {
        const r = await getRoute({ lat: origin[0], lng: origin[1] }, { lat: carpark.lat, lng: carpark.lng }, 'DRIVE');
        setDriveRoute(r); setDrivePolyline(decodePolyline(r.polyline));
      } catch { setDriveRoute(null); setDrivePolyline(null); }
    } else {
      setDriveRoute(null); setDrivePolyline(null);
    }

    try {
      const r = await getWalkRoute({ lat: carpark.lat, lng: carpark.lng }, { lat: dest.lat, lng: dest.lng });
      setWalkRoute(r); setWalkPolyline(decodePolyline(r.polyline));
    } catch { setWalkRoute(null); setWalkPolyline(null); }
  };

  const fetchDriveOnly = async (origin: [number, number], carpark: CarparkSummary) => {
    try {
      const r = await getRoute({ lat: origin[0], lng: origin[1] }, { lat: carpark.lat, lng: carpark.lng }, 'DRIVE');
      setDriveRoute(r); setDrivePolyline(decodePolyline(r.polyline));
    } catch { setDriveRoute(null); setDrivePolyline(null); }
    setWalkRoute(null); setWalkPolyline(null);
  };

  return {
    driveRoute, drivePolyline, walkRoute, walkPolyline,
    fetchRoutes, fetchDriveOnly, clearRoutes,
  };
}
