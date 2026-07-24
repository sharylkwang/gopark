export interface UraLiveLot {
  carparkNo: string;
  lotType: string;
  lotsAvailable: number;
  lat: number;
  lng: number;
}

export async function fetchUraStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/ura/status');
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body.configured);
  } catch {
    return false;
  }
}

export async function fetchUraLiveLots(): Promise<UraLiveLot[]> {
  const res = await fetch('/api/ura/availability');
  if (!res.ok) throw new Error('Failed to fetch URA live lots');
  const body = await res.json();
  return Array.isArray(body.lots) ? body.lots : [];
}
