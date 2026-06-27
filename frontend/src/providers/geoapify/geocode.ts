import type { GeocodeResponse, PlaceSuggestion, PlaceClassification, NearbyParking } from '../../types';

export async function geocodeLocation(query: string): Promise<GeocodeResponse> {
  const res = await fetch(`/api/geoapify/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Could not find destination');
  return res.json();
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ name: string; formatted: string }> {
  try {
    const res = await fetch(`/api/geoapify/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) return { name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, formatted: '' };
    return res.json();
  } catch {
    return { name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, formatted: '' };
  }
}

export async function classifyLocation(lat: number, lng: number): Promise<PlaceClassification | null> {
  try {
    const res = await fetch(`/api/overpass/classify?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.type ? data : null;
  } catch {
    return null;
  }
}

export async function fetchNearbyParking(lat: number, lng: number): Promise<NearbyParking[]> {
  try {
    const res = await fetch(`/api/overpass/nearby-parking?lat=${lat}&lng=${lng}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function autocompleteLocation(query: string): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`/api/geoapify/autocomplete?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
