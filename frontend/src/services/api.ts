import type { GeocodeResponse } from '../types';

export async function geocodeLocation(query: string): Promise<GeocodeResponse> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error('Could not find destination');
  }
  return res.json();
}
