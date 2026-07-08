import { ChevronLeft, Map, Navigation } from 'lucide-react';
import { AvailabilityBar } from '../AvailabilityBar';
import { TimeRange } from './TimeRange';
import { timeAgo, totals, formatParkDuration, formatTime12, parseClockTime, formatDuration, parseDurationSecs } from '../../utils/format';
import { estimateCost } from '../../utils/estimateCost';
import { LOT_LABELS, LOT_ICONS, DAY_LABELS } from '../../utils/constants';
import { cockpit, availabilityTone } from './theme';
import type { CarparkDetail } from '../../types';
import type { RouteResult } from '../../providers/google/routing';

interface Props {
  detail: CarparkDetail;
  darkMode: boolean;
  onClose: () => void;
  arrivalTime: Date;
  parkUntil: string;
  setParkUntil: (v: string) => void;
  durationHours: number;
  vehicleType: string;
  driveRoute: RouteResult | null;
  walkRoute: RouteResult | null;
}

export function MobileDetail({
  detail, darkMode, onClose, arrivalTime, parkUntil, setParkUntil,
  durationHours, vehicleType, driveRoute, walkRoute,
}: Props) {
  const c = cockpit(darkMode);
  const vAvail = detail.availability[vehicleType];
  const dt = vAvail
    ? { available: Math.min(vAvail.available ?? 0, vAvail.total ?? 0), total: vAvail.total ?? 0, pct: (vAvail.total ?? 0) > 0 ? Math.min(((vAvail.available ?? 0) / (vAvail.total ?? 1)) * 100, 100) : 0 }
    : totals(detail.availability);
  const tone = availabilityTone(dt.pct, dt.total);
  const cost = detail.rates?.length ? estimateCost(detail.rates, durationHours, vehicleType, arrivalTime) : null;
  const rates = detail.rates.filter(r => r.vehicleType === vehicleType);
  const destination = encodeURIComponent(detail.address || `${detail.name} Singapore`);
  const day = arrivalTime.getDay();
  const todayDayType = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';

  return (
    <div className="animate-slide-in pb-[env(safe-area-inset-bottom)]">
      <div className={`sticky top-0 z-10 flex items-center gap-2 px-1.5 py-1.5 ${c.surface} border-b ${c.line}`}>
        <button onClick={onClose} className={`flex items-center gap-0.5 h-9 pl-1.5 pr-3 rounded-xl text-[13px] font-bold ${c.text}`}>
          <ChevronLeft size={18} /> Back
        </button>
      </div>

      <div className="stagger px-3 pt-3 space-y-3">
        <div>
          <h2 className={`text-base font-black leading-tight ${c.text}`}>{detail.name}</h2>
          <p className={`text-[11px] font-medium mt-0.5 ${c.muted}`}>{detail.address || detail.id} · {detail.agency}</p>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Tile c={c} label={LOT_LABELS[vehicleType] ?? 'Lots'}>
            {dt.total > 0
              ? <span className={tone.text}>{dt.available}<span className={`text-[11px] ${c.muted}`}>/{dt.total}</span></span>
              : <span className={c.muted}>—</span>}
          </Tile>
          <Tile c={c} label="Est. cost">
            {cost != null ? <span className="text-[#22c55e]">${cost.toFixed(2)}</span> : <span className={c.muted}>—</span>}
          </Tile>
          <Tile c={c} label={walkRoute ? 'Walk' : 'Drive'}>
            {walkRoute
              ? formatDuration(parseDurationSecs(walkRoute.duration))
              : driveRoute
                ? formatDuration(parseDurationSecs(driveRoute.duration))
                : <span className={c.muted}>—</span>}
          </Tile>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-gmaps press flex items-center justify-center gap-1.5 h-11 rounded-xl text-xs font-black uppercase tracking-wide">
            <Map size={15} /> Google Maps
          </a>
          <a href={`https://waze.com/ul?q=${destination}&navigate=yes`}
            target="_blank" rel="noopener noreferrer"
            className="btn-waze press flex items-center justify-center gap-1.5 h-11 rounded-xl text-xs font-black uppercase tracking-wide">
            <Navigation size={15} /> Waze
          </a>
        </div>

        <div className={`rounded-xl border p-3 ${c.panel} ${c.line}`}>
          <div className="flex items-baseline justify-between">
            <span className={`text-[10px] font-black uppercase tracking-widest ${c.muted}`}>You pay</span>
            {cost != null
              ? <span className="text-2xl font-black text-[#22c55e]">${cost.toFixed(2)}</span>
              : <span className={`text-sm font-bold ${c.muted}`}>No rates listed</span>}
          </div>
          <p className={`text-[11px] font-medium mt-0.5 ${c.muted}`}>
            {LOT_LABELS[vehicleType] ?? vehicleType} · {formatParkDuration(durationHours)} · {formatTime12(arrivalTime)} → {formatTime12(parseClockTime(parkUntil))}
          </p>

          <div className={`h-px my-3 ${darkMode ? 'bg-white/8' : 'bg-black/8'}`} />

          <TimeRange c={c} darkMode={darkMode} arrivalTime={arrivalTime}
            parkUntil={parkUntil} setParkUntil={setParkUntil} />
        </div>

        <div className="space-y-1.5">
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${c.muted}`}>By lot type</h3>
          {Object.entries(detail.availability)
            .sort(([a], [b]) => (a === vehicleType ? -1 : b === vehicleType ? 1 : 0))
            .map(([lt, e]) => {
              const Icon = LOT_ICONS[lt];
              return (
                <div key={lt} className={`rounded-xl border px-3 py-2 ${lt === vehicleType ? 'border-yellow-400/40' : c.line} ${c.panel}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {Icon && <Icon size={13} className={c.muted} />}
                    <span className={`text-xs font-bold ${c.text}`}>{LOT_LABELS[lt] ?? lt}</span>
                    {e.updatedAt && <span className={`text-[10px] ml-auto ${c.muted}`}>{timeAgo(e.updatedAt)}</span>}
                  </div>
                  <AvailabilityBar available={e.available} total={e.total} darkMode={darkMode} />
                </div>
              );
            })}
        </div>

        {rates.length > 0 && (
          <div className="space-y-1.5">
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${c.muted}`}>
              {LOT_LABELS[vehicleType] ?? vehicleType} rates
            </h3>
            {Object.entries(
              rates.reduce((g, r) => { (g[r.dayType] ??= []).push(r); return g; }, {} as Record<string, typeof rates>)
            )
              .sort(([a], [b]) => Number(b === todayDayType) - Number(a === todayDayType))
              .map(([day, group]) => {
                const applies = day === todayDayType || day === 'all';
                return (
                  <div key={day} className={`rounded-xl border px-3 py-2.5 ${applies ? 'border-yellow-400/50' : c.line} ${c.panel}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${applies ? 'text-yellow-500' : c.muted}`}>
                        {DAY_LABELS[day] ?? day}
                      </p>
                      {applies && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-yellow-400 text-[#0d1013]">
                          Today
                        </span>
                      )}
                    </div>
                    {group.map((r, i) => (
                      <div key={i} className={`flex justify-between items-center gap-2 py-1 ${i > 0 ? `border-t ${c.line}` : ''}`}>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${c.text}`}>{rateUnitLabel(r)}</p>
                          {r.periodStart && (
                            <p className={`text-[10px] font-medium ${c.muted}`}>{r.periodStart}–{r.periodEnd}</p>
                          )}
                        </div>
                        <span className={`shrink-0 text-sm font-black ${c.text}`}>${r.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        )}

        <p className={`text-[10px] pb-3 ${c.muted}`}>Availability {timeAgo(detail.availabilityUpdatedAt)}</p>
      </div>
    </div>
  );
}

function rateUnitLabel(r: CarparkDetail['rates'][number]) {
  const per = r.durationMins === 1440 ? 'per day'
    : r.durationMins === 60 ? 'per hour'
    : r.durationMins ? `per ${r.durationMins} min`
    : r.unit.replace(/_/g, ' ');
  return r.isFirst ? `First ${per.replace(/^per /, '')}` : per;
}

function Tile({ c, label, children }: { c: ReturnType<typeof cockpit>; label: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-2 py-2 text-center ${c.panel} ${c.line}`}>
      <p className={`text-base font-black leading-none ${c.text}`}>{children}</p>
      <p className={`text-[9px] font-black uppercase tracking-wider mt-1.5 truncate ${c.muted}`}>{label}</p>
    </div>
  );
}
