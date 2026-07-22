import { Heart, Star } from 'lucide-react';
import { formatDistance, vehicleTotals } from '../../utils/format';
import { cockpit, availabilityTone } from './theme';
import type { CarparkSummary } from '../../types';

interface Props {
  cp: CarparkSummary & { estimatedCost?: number | null };
  selected: boolean;
  isFav: boolean;
  canFavorite: boolean;
  darkMode: boolean;
  vehicleType: string;
  recommended: boolean;
  dense?: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}

export function MobileResultRow({ cp, selected, isFav, canFavorite, darkMode, vehicleType, recommended, dense = false, onSelect, onToggleFav }: Props) {
  const c = cockpit(darkMode);
  const t = vehicleTotals(cp.availability, vehicleType);
  const tone = availabilityTone(t.pct, t.total);

  return (
    <button onClick={onSelect}
      className={`press w-full flex items-center gap-3 px-3 text-left transition-colors ${dense ? 'py-1.5' : 'py-2.5'} ${
        recommended ? 'top-pick-row' : selected ? (darkMode ? 'bg-white/6' : 'bg-black/4') : ''
      }`}>
      <div className={`shrink-0 rounded-xl grid place-items-center ${dense ? 'w-10 h-10' : 'w-12 h-12'} ${tone.bg}`}>
        {t.available != null ? (
          <>
            <span className={`font-black leading-none ${dense ? 'text-base' : 'text-lg'} ${tone.text}`}>{t.available}</span>
            <span className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${c.muted}`}>lots</span>
          </>
        ) : (
          <span className={`text-[9px] font-black uppercase tracking-wider ${c.muted}`}>N/A</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {recommended && (
            <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-yellow-400 text-[#0d1013]">
              <Star size={10} fill="currentColor" strokeWidth={0} /> Best
            </span>
          )}
          <h3 className={`font-bold text-[13px] leading-tight truncate ${c.text}`}>{cp.name}</h3>
        </div>
        <p className={`text-[11px] font-medium mt-0.5 ${c.muted}`}>
          {cp.distance != null && formatDistance(cp.distance)}
          {cp.distance != null && cp.estimatedCost != null && ' · '}
          {cp.estimatedCost != null && <span className="text-[#22c55e] font-bold">${cp.estimatedCost.toFixed(2)}</span>}
        </p>
      </div>

      {canFavorite && (
        <span onClick={onToggleFav}
          className={`shrink-0 h-10 w-10 grid place-items-center rounded-xl ${isFav ? 'text-red-500' : c.muted}`}>
          <Heart size={17} fill={isFav ? 'currentColor' : 'none'} strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
}
