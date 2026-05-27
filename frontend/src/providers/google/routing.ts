export interface RouteResult {
  distanceMeters: number;
  duration: string;
  polyline: string;
  trafficCondition: string;
}

export async function getRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteResult> {
  const res = await fetch('/api/google/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });

  if (!res.ok) throw new Error('Failed to get route');
  return res.json();
}
