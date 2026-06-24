import { Heart, Navigation } from 'lucide-react';
import { AvailabilityBar } from './AvailabilityBar';
import { formatDistance, totals } from '../utils/format';
import type { CarparkSummary } from '../types';

interface Props {
  cp: CarparkSummary & { estimatedCost?: number | null };
  selected: boolean;
  isFav: boolean;
  darkMode: boolean;
  vehicleType?: string;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}

export function CarparkCard({ cp, selected, isFav, darkMode, vehicleType, onSelect, onToggleFav }: Props) {
  const vAvail = vehicleType ? cp.availability[vehicleType] : null;
  const t = vAvail
    ? { available: vAvail.available ?? 0, total: vAvail.total ?? 0, pct: (vAvail.total ?? 0) > 0 ? ((vAvail.available ?? 0) / (vAvail.total ?? 1)) * 100 : 0 }
    : totals(cp.availability);

  return (
    <div onClick={onSelect}
      className={`border-2 rounded-xl p-3 cursor-pointer transition-all duration-200 ${
        selected
          ? darkMode ? 'bg-neutral-700 border-blue-500 shadow-lg ring-4 ring-blue-500/20' : 'bg-white border-red-600 shadow-lg ring-4 ring-red-100'
          : darkMode ? 'bg-neutral-800 border-neutral-700 hover:border-blue-400' : 'bg-white border-gray-100 hover:border-red-400'
      }`}>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex-1 min-w-0">
          <h3 className={`font-black text-sm leading-tight truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{cp.name}</h3>
          <p className={`text-[10px] truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{cp.address || cp.id}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button onClick={onToggleFav} className={`transition hover:scale-110 ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
            <Heart size={16} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
          </button>
          {t.total > 0 && (
            <div className={`text-[10px] font-black px-1.5 py-0.5 rounded ${t.pct > 30 ? 'bg-green-100 text-green-700' : t.pct > 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {t.available}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-end mt-2">
        <div className="flex-1 mr-3">
          <AvailabilityBar available={t.total > 0 ? t.available : null} total={t.total || null} compact />
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          {cp.estimatedCost != null && (
            <span className="text-xs font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
              ~${cp.estimatedCost.toFixed(2)}
            </span>
          )}
          {cp.distance != null && (
            <p className={`text-xs font-bold flex items-center justify-end gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Navigation size={10} className="text-red-500" />
              {formatDistance(cp.distance)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
