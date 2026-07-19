export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE' | 'BFA';

export interface SpeedInterval {
  startPolylinePointIndex: number;
  endPolylinePointIndex: number;
  speed: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
}

export const SPEED_COLORS = { NORMAL: '#22c55e', SLOW: '#f59e0b', TRAFFIC_JAM: '#dc2626' } as Record<string, string>;

export interface RouteResult {
  distanceMeters: number;
  duration: string;
  polyline: string;
  travelMode: TravelMode;
  trafficCondition: string;
  speedIntervals: SpeedInterval[];
}

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: TravelMode = 'DRIVE',
): Promise<RouteResult> {
  const res = await fetch('/api/google/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, travelMode }),
  });

  if (!res.ok) throw new Error('route lookup failed');
  return res.json();
}
