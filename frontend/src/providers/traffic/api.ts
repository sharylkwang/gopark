export interface TrafficIncident {
  id: string;
  type: string;
  lat: number;
  lng: number;
  time: string | null;
  headline: string;
  message: string;
}

export async function fetchTrafficIncidents(): Promise<TrafficIncident[]> {
  try {
    const res = await fetch('/api/traffic/incidents');
    if (!res.ok) return [];
    const data = await res.json();
    return data.incidents ?? [];
  } catch {
    return [];
  }
}
