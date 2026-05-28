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
