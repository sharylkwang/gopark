import { useEffect, useMemo, useState } from 'react';
import { fetchTrafficIncidents } from '../providers/traffic';
import type { TrafficIncident } from '../providers/traffic';

const REFRESH_MS = 60000;
const NEARBY_KM = 12;

const TYPE_COLORS: Record<string, string> = {
  'accident': 'bg-red-600',
  'roadwork': 'bg-amber-500',
  'vehicle breakdown': 'bg-orange-500',
  'heavy traffic': 'bg-purple-600',
  'weather': 'bg-sky-600',
  'road block': 'bg-rose-700',
  'obstacle': 'bg-yellow-600',
  'diversion': 'bg-indigo-600',
};

function typeColor(type: string) {
  return TYPE_COLORS[type.toLowerCase()] ?? 'bg-slate-600';
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * 111.32;
  const dLng = (bLng - aLng) * 111.32 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function dedupeById(list: TrafficIncident[]): TrafficIncident[] {
  const seen = new Set<string>();
  return list.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

export function TrafficTicker({ userLocation, destination, darkMode, compact, onSelect }: {
  userLocation?: [number, number] | null;
  destination?: { lat: number; lng: number } | null;
  darkMode?: boolean;
  compact?: boolean;
  onSelect: (incident: TrafficIncident) => void;
}) {
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => fetchTrafficIncidents().then(list => { if (active) setIncidents(dedupeById(list)); });
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(id); };
  }, []);

  const ordered = useMemo(() => {
    const anchors: [number, number][] = [];
    if (userLocation) anchors.push(userLocation);
    if (destination) anchors.push([destination.lat, destination.lng]);
    if (!anchors.length) return incidents;

    const nearness = (i: TrafficIncident) =>
      Math.min(...anchors.map(([lat, lng]) => distanceKm(lat, lng, i.lat, i.lng)));

    const scored = incidents.map(i => ({ i, d: nearness(i) }));
    const nearby = scored.filter(s => s.d <= NEARBY_KM).sort((a, b) => a.d - b.d);
    const rest = scored.filter(s => s.d > NEARBY_KM).sort((a, b) => a.d - b.d);
    return [...nearby, ...rest].map(s => s.i);
  }, [incidents, userLocation?.[0], userLocation?.[1], destination?.lat, destination?.lng]);

  if (!ordered.length) return null;

  const durationSec = Math.max(50, ordered.length * 16);

  return (
    <div className={`flex items-stretch shadow-lg overflow-hidden ${compact ? 'h-7' : 'h-8'} ${darkMode ? 'bg-neutral-900/95 text-gray-100' : 'bg-[#101418]/95 text-gray-100'}`}>
      <span className={`shrink-0 flex items-center gap-1.5 bg-yellow-400 text-[#0d1013] font-black uppercase tracking-widest ${compact ? 'px-2 text-[9px]' : 'px-3 text-[10px]'}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 live-pulse" />
        Traffic
      </span>
      <div className="relative flex-1 overflow-hidden">
        <div className="news-ticker-track absolute inset-y-0 flex items-center gap-10 w-max pl-4"
          style={{ animationDuration: `${durationSec}s` }}>
          {[0, 1].map(copy => ordered.map((incident, i) => (
            <button key={`${copy}-${i}-${incident.id}`} onClick={() => onSelect(incident)}
              className="group flex items-center gap-2 shrink-0 whitespace-nowrap">
              <span className={`rounded font-black uppercase tracking-wider text-white ${typeColor(incident.type)} ${compact ? 'px-1 py-px text-[8px]' : 'px-1.5 py-0.5 text-[9px]'}`}>
                {incident.type}
              </span>
              {incident.time && (
                <span className={`font-bold text-gray-400 tabular-nums ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{incident.time}</span>
              )}
              <span className={`font-medium text-gray-200 ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
                {incident.headline}
              </span>
            </button>
          )))}
        </div>
      </div>
    </div>
  );
}
