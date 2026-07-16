import type { RouteResult } from '../google/routing';

export async function getWalkRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteResult> {
  const res = await fetch('/api/onemap/walk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });

  if (!res.ok) throw new Error('walking route failed');
  return res.json();
}

export async function getBfaRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteResult> {
  const res = await fetch('/api/onemap/bfa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });

  if (!res.ok) throw new Error('no barrier-free route');
  return res.json();
}
