import { ChevronLeft, Map, Navigation, Clock } from 'lucide-react';
import { CircularProgress } from './CircularProgress';
import { AvailabilityBar } from './AvailabilityBar';
import { DurationChips } from './DurationChips';
import { timeAgo, totals, formatParkDuration, formatTime12, parseClockTime } from '../utils/format';
import { estimateCost } from '../utils/estimateCost';
import { LOT_LABELS, LOT_ICONS, DAY_LABELS } from '../utils/constants';
import type { CarparkDetail } from '../types';

interface Props {
  detail: CarparkDetail;
  darkMode: boolean;
  onClose: () => void;
  arrivalTime: Date;
  parkUntil: string;
  setParkUntil: (v: string) => void;
  durationHours: number;
  vehicleType: string;
}

export function DetailPanel({ detail, darkMode, onClose, arrivalTime, parkUntil, setParkUntil, durationHours, vehicleType }: Props) {
  const vAvail = detail.availability[vehicleType];
  const dt = vAvail
    ? { available: vAvail.available != null ? Math.min(vAvail.available, vAvail.total ?? vAvail.available) : null, total: vAvail.total ?? 0, pct: vAvail.available != null && (vAvail.total ?? 0) > 0 ? Math.min((vAvail.available / (vAvail.total ?? 1)) * 100, 100) : 0 }
    : totals(detail.availability);
  const dm = darkMode;
  const cost = detail.rates?.length ? estimateCost(detail.rates, durationHours, vehicleType, arrivalTime) : null;
  const sortedLots = Object.entries(detail.availability).sort(([a], [b]) => a === vehicleType ? -1 : b === vehicleType ? 1 : 0);

  return (
    <div className="animate-slide-in">
      <div className={`sticky top-0 z-10 px-3 py-2 flex items-center ${dm ? 'bg-neutral-900 border-b border-neutral-700/50' : 'bg-white border-b border-gray-200/60'}`}>
        <button onClick={onClose} className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-wider transition ${dm ? 'text-gray-400 hover:text-blue-400' : 'text-gray-500 hover:text-blue-600'}`}>
          <ChevronLeft size={14} /> Back
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        <div>
          <h2 className={`text-sm font-black leading-tight ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{detail.name}</h2>
          <p className={`text-[10px] mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{detail.address || detail.id} · {detail.agency}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {detail.sources.map(s => (
              <span key={s} className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${dm ? 'bg-neutral-700/60 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{s}</span>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2.5">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.address || detail.name + ' Singapore')}`}
              target="_blank" rel="noopener noreferrer"
              className={`flex-1 font-black text-[9px] uppercase tracking-widest py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${dm ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'}`}>
              <Map size={12} /> Google Maps
            </a>
            <a href={`https://waze.com/ul?q=${encodeURIComponent(detail.address || detail.name + ' Singapore')}&navigate=yes`}
              target="_blank" rel="noopener noreferrer"
              className={`flex-1 font-black text-[9px] uppercase tracking-widest py-1.5 rounded-xl flex items-center justify-center gap-1 transition ${dm ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25' : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-600 border border-cyan-200'}`}>
              <Navigation size={12} /> Waze
            </a>
          </div>
        </div>

        <div className={`rounded-xl border px-3 py-2.5 ${dm ? 'bg-neutral-800/50 border-neutral-700/50' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock size={14} className={dm ? 'text-gray-400' : 'text-gray-500'} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{formatTime12(arrivalTime)} → {formatTime12(parseClockTime(parkUntil))}</span>
            </div>
            <span className={`text-sm font-black ${dm ? 'text-blue-400' : 'text-blue-700'}`}>{formatParkDuration(durationHours)}</span>
          </div>
          <DurationChips arrivalTime={arrivalTime} parkUntil={parkUntil} setParkUntil={setParkUntil} dm={dm} small />
          {cost != null && (
            <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 ${dm ? 'bg-green-900/30 border border-green-700/40' : 'bg-green-50 border border-green-200'}`}>
              <span className={`text-[11px] font-black uppercase tracking-widest ${dm ? 'text-green-400' : 'text-green-700'}`}>Estimated Cost</span>
              <span className={`text-lg font-black ${dm ? 'text-green-400' : 'text-green-700'}`}>${cost.toFixed(2)}</span>
            </div>
          )}
        </div>

        {vAvail && dt.total > 0 && dt.available != null ? (
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${dm ? 'bg-neutral-800/50 border-neutral-700/50' : 'bg-gray-50 border-gray-200'}`}>
            <CircularProgress percentage={dt.pct} size={64} stroke={8} darkMode={dm} />
            <div>
              <p className={`text-xl font-black ${dm ? 'text-gray-100' : 'text-gray-900'}`}>{dt.available} <span className={`text-xs font-bold ${dm ? 'text-gray-500' : 'text-gray-400'}`}>/ {dt.total}</span></p>
              <p className={`text-[9px] font-bold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{LOT_LABELS[vehicleType]}</p>
            </div>
          </div>
        ) : !vAvail && (
          <div className={`p-3 rounded-xl border ${dm ? 'bg-neutral-800/50 border-neutral-700/50' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-[11px] font-bold italic ${dm ? 'text-gray-400' : 'text-gray-500'}`}>No {LOT_LABELS[vehicleType] ?? vehicleType} lots at this carpark</p>
          </div>
        )}

        <div className="space-y-1.5">
          <h3 className={`text-[9px] font-black uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}>By Lot Type</h3>
          {sortedLots.map(([lt, e]) => {
            const Icon = LOT_ICONS[lt];
            const active = lt === vehicleType;
            return (
              <div key={lt} className={`rounded-xl border px-2.5 py-2 ${active ? (dm ? 'bg-blue-900/30 border-blue-500/40' : 'bg-blue-50 border-blue-200') : (dm ? 'bg-neutral-800/40 border-neutral-700/40' : 'bg-gray-50 border-gray-200')}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {Icon && <Icon size={12} className={dm ? 'text-gray-400' : 'text-gray-500'} />}
                  <span className={`text-[11px] font-black ${dm ? 'text-gray-300' : 'text-gray-700'}`}>{LOT_LABELS[lt] ?? lt}</span>
                  {e.updatedAt && <span className={`text-[8px] ml-auto ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{timeAgo(e.updatedAt)}</span>}
                </div>
                <AvailabilityBar available={e.available} total={e.total} darkMode={dm} />
              </div>
            );
          })}
        </div>

        {detail.rates.filter(r => r.vehicleType === vehicleType).length > 0 && (
          <div className="space-y-1.5">
            <h3 className={`text-[9px] font-black uppercase tracking-widest ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{LOT_LABELS[vehicleType] ?? vehicleType} Rates</h3>
            {Object.entries(
              detail.rates.filter(r => r.vehicleType === vehicleType).reduce((g, r) => { (g[r.dayType] ??= []).push(r); return g; }, {} as Record<string, typeof detail.rates>)
            ).map(([day, rates]) => (
              <div key={day} className={`rounded-xl border px-2.5 py-2 ${dm ? 'bg-neutral-800/40 border-neutral-700/40' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">{DAY_LABELS[day] ?? day}</p>
                {rates.map((r, i) => (
                  <div key={i} className="flex justify-between items-baseline py-px">
                    <span className={`text-[11px] ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                      {r.isFirst ? 'First ' : ''}
                      {r.durationMins === 1440 ? 'per day' : r.durationMins === 60 ? 'per hr' : r.durationMins ? `per ${r.durationMins}min` : r.unit.replace(/_/g, ' ')}
                      {r.periodStart && <span className={dm ? 'text-gray-500 ml-1' : 'text-gray-400 ml-1'}> {r.periodStart}–{r.periodEnd}</span>}
                    </span>
                    <span className={`text-xs font-black ${dm ? 'text-gray-100' : 'text-gray-900'}`}>${r.amount.toFixed(2)}</span>
                  </div>
                ))}
                {rates[0]?.confirmedBy > 1 && <p className="text-[8px] text-green-500 font-bold mt-0.5">Confirmed by {rates[0].confirmedBy} sources</p>}
              </div>
            ))}
          </div>
        )}

        <div className={`text-[9px] pb-2 flex gap-3 ${dm ? 'text-gray-600' : 'text-gray-400'}`}>
          <span>Details {timeAgo(detail.detailsUpdatedAt)}</span>
          <span>Avail {timeAgo(detail.availabilityUpdatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
