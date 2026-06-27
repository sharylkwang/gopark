export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
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
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m} mins`;
  return m > 0 ? `${h}h ${m} mins` : `${h}h`;
}

export function parseDurationSecs(dur: string) {
  return parseInt(dur.replace('s', ''), 10) || 0;
}

export function totals(avail: Record<string, { available: number | null; total: number | null }>) {
  const entries = Object.values(avail);
  const available = entries.reduce((sum, e) => sum + (e.available ?? 0), 0);
  const total = entries.reduce((sum, e) => sum + (e.total ?? 0), 0);
  const capped = Math.min(available, total);
  const pct = total > 0 ? Math.min((capped / total) * 100, 100) : 0;
  return { available: capped, total, pct };
}
