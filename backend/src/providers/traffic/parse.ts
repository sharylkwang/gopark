export interface TrafficIncident {
  id: string;
  type: string;
  lat: number;
  lng: number;
  time: string | null;
  headline: string;
  message: string;
}

const STAMP = /^\((\d{1,2})\/(\d{1,2})\)(\d{1,2}):(\d{2})\s*/;

export function parseIncident(raw: { Type?: string; Latitude?: number; Longitude?: number; Message?: string }): TrafficIncident | null {
  const message = (raw.Message ?? '').trim();
  const lat = Number(raw.Latitude);
  const lng = Number(raw.Longitude);
  if (!message || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const stamp = message.match(STAMP);
  const time = stamp ? `${stamp[3].padStart(2, '0')}:${stamp[4]}` : null;
  const headline = message.replace(STAMP, '').trim();

  return {
    id: `${lat.toFixed(5)},${lng.toFixed(5)}:${headline.slice(0, 60)}`,
    type: (raw.Type ?? 'Incident').trim(),
    lat,
    lng,
    time,
    headline,
    message,
  };
}
