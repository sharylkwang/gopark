export function isLatLng(point: unknown): point is { lat: number; lng: number } {
  if (point == null || typeof point !== 'object') return false;
  const { lat, lng } = point as { lat?: unknown; lng?: unknown };
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat as number) >= -90 &&
    (lat as number) <= 90 &&
    (lng as number) >= -180 &&
    (lng as number) <= 180
  );
}
