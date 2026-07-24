import { Heart, Navigation, ParkingSquare } from 'lucide-react';
import { AvailabilityBar } from './AvailabilityBar';
import { formatDistance, vehicleTotals } from '../utils/format';
import type { CarparkSummary } from '../types';

interface Props {
  cp: CarparkSummary & { estimatedCost?: number | null };
  selected: boolean;
  isFav: boolean;
  canFavorite?: boolean;
  darkMode: boolean;
  vehicleType?: string;
  recommended?: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}

export function CarparkCard({ cp, selected, isFav, canFavorite = true, darkMode, vehicleType, recommended, onSelect, onToggleFav }: Props) {
  const t = vehicleTotals(cp.availability, vehicleType);

  return (
    <div onClick={onSelect}
      className={`press rounded-2xl p-2.5 cursor-pointer transition-all duration-200 ${
        recommended ? 'recommended-card border-2 ' : 'border '
      }${
        selected
          ? darkMode ? 'bg-neutral-700/60 border-blue-500/70 shadow-lg ring-2 ring-blue-500/20' : 'bg-white/70 border-red-500/60 shadow-lg ring-2 ring-red-100/60'
          : recommended
            ? darkMode ? 'bg-neutral-800/40 border-emerald-500 shadow-md' : 'bg-white/60 border-emerald-500 shadow-md'
            : darkMode ? 'bg-neutral-800/40 border-neutral-600/40 hover:border-blue-400/50' : 'bg-white/40 border-gray-200/40 hover:border-red-400/50'
      }`}>
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <ParkingSquare size={16} className={`shrink-0 mt-0.5 ${selected ? 'text-blue-500' : recommended ? 'text-emerald-500' : darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className={`font-black text-sm leading-tight truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{cp.name}</h3>
              {recommended && <span className="recommended-tag text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white shrink-0">Top Pick</span>}
            </div>
            <p className={`text-[10px] truncate ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{cp.address || cp.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
           {canFavorite && (
            <button onClick={onToggleFav} className={`p-1.5 -m-1.5 transition hover:scale-110 ${isFav ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}>
              <Heart size={16} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>
           )}
           {t.total > 0 && (
            <div className={`text-[10px] font-black px-1.5 py-0.5 rounded ${t.pct > 30 ? (darkMode ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700') : t.pct > 10 ? (darkMode ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-700') : (darkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700')}`}>
              {t.available}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-end mt-2">
        <div className="flex-1 mr-3">
          <AvailabilityBar available={t.available} total={t.total || null} compact darkMode={darkMode} />
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          {cp.estimatedCost != null && (
            <span className={`text-xs font-black px-1.5 py-0.5 rounded ${darkMode ? 'text-green-400 bg-green-900/40' : 'text-green-700 bg-green-50'}`}>
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
