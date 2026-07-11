export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return '<1 min';
  return `${Math.round(seconds / 60)} min`;
}

export function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export function formatParkDuration(hours: number) {
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60), m = totalMins % 60;
  if (h === 0) return `${m} mins`;
  return m > 0 ? `${h}h ${m} mins` : `${h}h`;
}

export function formatClockTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatTime12(d: Date) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function parseClockTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function parseDurationSecs(dur: string) {
  return parseInt(dur.replace('s', ''), 10) || 0;
}

export function hasFreeLots(avail: Record<string, { available: number | null; total: number | null }>, vehicleType: string) {
  const forVehicle = avail[vehicleType];
  if (forVehicle) return (forVehicle.total ?? 0) > 0 && (forVehicle.available ?? 0) > 0;
  if (vehicleType !== 'C') return false;
  const t = totals(avail);
  return t.total > 0 && (t.available ?? 0) > 0;
}

export function totals(avail: Record<string, { available: number | null; total: number | null }>) {
  const entries = Object.values(avail);
  const hasLive = entries.some(e => e.available != null);
  const total = entries.reduce((sum, e) => sum + (e.total ?? 0), 0);
  if (!hasLive) return { available: null, total, pct: 0 };
  const available = entries.reduce((sum, e) => sum + (e.available ?? 0), 0);
  const capped = total > 0 ? Math.min(available, total) : available;
  const pct = total > 0 ? Math.min((capped / total) * 100, 100) : 0;
  return { available: capped, total, pct };
}

export function vehicleTotals(
  avail: Record<string, { available: number | null; total: number | null }>,
  vehicleType?: string,
) {
  const forVehicle = vehicleType ? avail[vehicleType] : undefined;
  if (forVehicle) {
    const total = forVehicle.total ?? 0;
    const raw = forVehicle.available;
    const available = raw == null ? null : total > 0 ? Math.min(raw, total) : raw;
    const pct = total > 0 && available != null ? Math.min((available / total) * 100, 100) : 0;
    return { available, total, pct, hasVehicleData: true };
  }
  if (!vehicleType || vehicleType === 'C') return { ...totals(avail), hasVehicleData: false };
  return { available: null, total: 0, pct: 0, hasVehicleData: false };
}
