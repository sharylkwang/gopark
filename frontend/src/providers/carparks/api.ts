import type { CarparkSummary, CarparkDetail } from '../../types';

export async function fetchAll(): Promise<CarparkSummary[]> {
  const res = await fetch('/api/carparks');
  if (!res.ok) throw new Error('Failed to fetch carparks');
  return res.json();
}

export async function fetchNearby(lat: number, lng: number, radius = 1000): Promise<CarparkSummary[]> {
  const res = await fetch(`/api/carparks/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  if (!res.ok) throw new Error('Failed to fetch carparks');
  return res.json();
}

export async function fetchDetail(id: string): Promise<CarparkDetail> {
  const res = await fetch(`/api/carparks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Carpark not found');
  return res.json();
}

export async function fetchAvailability(): Promise<{
  updatedAt: string;
  carparks: Record<string, Record<string, { available: number | null; total: number | null }>>;
}> {
  const res = await fetch('/api/carparks/availability');
  if (!res.ok) throw new Error('Failed to fetch availability');
  return res.json();
}