import { ChevronLeft, X, Map, Navigation } from 'lucide-react';
import { CircularProgress } from './CircularProgress';
import { AvailabilityBar } from './AvailabilityBar';
import { timeAgo, totals } from '../utils/format';
import { LOT_LABELS, LOT_ICONS, DAY_LABELS } from '../utils/constants';
import type { CarparkDetail } from '../types';

interface Props {
  detail: CarparkDetail;
  darkMode: boolean;
  onClose: () => void;
}

export function DetailPanel({ detail, darkMode, onClose }: Props) {
  const dt = totals(detail.availability);

  return (
    <div className={`w-[360px] min-w-[320px] max-w-[400px] backdrop-blur-sm flex flex-col z-20 shrink-0 overflow-y-auto ${darkMode ? 'bg-neutral-900/95 border-l border-neutral-700' : 'bg-white/95 border-l border-gray-200'}`}>
      <div className={`sticky top-0 backdrop-blur-sm p-3 flex items-center justify-between z-10 ${darkMode ? 'bg-neutral-900/95 border-b border-neutral-700' : 'bg-white/95 border-b border-gray-200'}`}>
        <button onClick={onClose} className={`flex items-center gap-1 text-xs font-black uppercase tracking-wider transition ${darkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'}`}>
          <ChevronLeft size={14} /> Back
        </button>
        <button onClick={onClose} className={darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}><X size={16} /></button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h2 className={`text-lg font-black leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{detail.name}</h2>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{detail.address || detail.id} &middot; {detail.agency}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {detail.sources.map(s => (
              <span key={s} className="text-[9px] font-black uppercase tracking-wider bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detail.address || detail.name + ' Singapore')}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-black text-[10px] uppercase tracking-widest py-2 rounded-lg flex items-center justify-center gap-1.5 transition">
              <Map size={14} /> Google Maps
            </a>
            <a href={`https://waze.com/ul?q=${encodeURIComponent(detail.address || detail.name + ' Singapore')}&navigate=yes`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 border border-cyan-200 font-black text-[10px] uppercase tracking-widest py-2 rounded-lg flex items-center justify-center gap-1.5 transition">
              <Navigation size={14} /> Waze
            </a>
          </div>
        </div>

        {dt.total > 0 && (
          <div className={`flex items-center gap-4 p-4 rounded-xl border shadow-sm ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
            <CircularProgress percentage={dt.pct} size={90} stroke={10} />
            <div>
              <p className={`text-2xl font-black ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{dt.available} <span className={`text-sm font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>/ {dt.total}</span></p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Available</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>By Lot Type</h3>
          {Object.entries(detail.availability).map(([lt, e]) => {
            const Icon = LOT_ICONS[lt];
            return (
              <div key={lt} className={`rounded-lg border p-3 ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {Icon && <Icon size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />}
                  <span className={`text-xs font-black ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{LOT_LABELS[lt] ?? lt}</span>
                  {e.updatedAt && <span className={`text-[9px] ml-auto ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{timeAgo(e.updatedAt)}</span>}
                </div>
                <AvailabilityBar available={e.available} total={e.total} />
              </div>
            );
          })}
        </div>

        {detail.rates.length > 0 && (
          <div className="space-y-2">
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Parking Rates</h3>
            {Object.entries(
              detail.rates.reduce((g, r) => { (g[r.dayType] ??= []).push(r); return g; }, {} as Record<string, typeof detail.rates>)
            ).map(([day, rates]) => (
              <div key={day} className={`rounded-lg border p-3 ${darkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'}`}>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">{DAY_LABELS[day] ?? day}</p>
                {rates.map((r, i) => (
                  <div key={i} className="flex justify-between items-baseline py-0.5">
                    <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {r.isFirst ? 'First ' : ''}
                      {r.durationMins === 1440 ? 'per day' : r.durationMins === 60 ? 'per hr' : r.durationMins ? `per ${r.durationMins}min` : r.unit.replace(/_/g, ' ')}
                      {r.periodStart && <span className={darkMode ? 'text-gray-500 ml-1' : 'text-gray-400 ml-1'}> {r.periodStart} – {r.periodEnd}</span>}
                    </span>
                    <span className={`text-sm font-black ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>${r.amount.toFixed(2)}</span>
                  </div>
                ))}
                {rates[0]?.confirmedBy > 1 && <p className="text-[9px] text-green-600 font-bold mt-1">Confirmed by {rates[0].confirmedBy} sources</p>}
              </div>
            ))}
          </div>
        )}

        <div className={`text-[10px] space-y-0.5 pb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <p>Details: {timeAgo(detail.detailsUpdatedAt)}</p>
          <p>Availability: {timeAgo(detail.availabilityUpdatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
