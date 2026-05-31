import type { GeocodeResponse } from '../../types';

export async function geocodeLocation(query: string): Promise<GeocodeResponse> {
  const res = await fetch(`/api/geoapify/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Could not find destination');
  return res.json();
}

export async function autocompleteLocation(query: string): Promise<any[]> {
  if (!query.trim()) return [];
  
  try {
    const res = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.error("Autocomplete failed:", err);
    return [];
  }
}