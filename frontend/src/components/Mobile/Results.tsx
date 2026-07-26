import { LocateFixed, Search, ChevronUp, Heart } from 'lucide-react';
import { MobileResultRow } from './ResultRow';
import { cockpit, lift } from './theme';
import type { CarparkSummary } from '../../types';

interface ResultsProps {
  darkMode: boolean;
  hasSearched: boolean;
  loading: boolean;
  results: (CarparkSummary & { estimatedCost?: number | null })[];
  isFavoritesTab: boolean;
  canFavorite: boolean;
  dense?: boolean;
  favoritesCount?: number;
  onTabChange?: (tab: 'search' | 'favorites') => void;
  selectedId: string | null;
  favorites: Set<string>;
  vehicleType: string;
  recommendedId: string | null;
  onSelectCarpark: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}

export function MobileResults({
  darkMode, hasSearched, loading, results, isFavoritesTab, canFavorite, favoritesCount = 0, onTabChange,
  selectedId, favorites, vehicleType, recommendedId, dense = false, onSelectCarpark, onToggleFav,
}: ResultsProps) {
  const c = cockpit(darkMode);

  const tabs = canFavorite && onTabChange ? (
    <div className={`sticky top-0 z-10 flex px-3 pt-1 gap-1 ${c.surface} border-b ${c.line}`}>
      {(['search', 'favorites'] as const).map(tab => {
        const active = (tab === 'favorites') === isFavoritesTab;
        return (
          <button key={tab} onClick={() => onTabChange(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 pb-2 pt-1 text-[11px] font-black uppercase tracking-widest border-b-2 transition-colors ${
              active ? 'border-yellow-400 text-yellow-500' : `border-transparent ${c.muted}`
            }`}>
            {tab === 'favorites' && <Heart size={12} fill={active ? 'currentColor' : 'none'} strokeWidth={2.5} />}
            {tab === 'search' ? 'Nearby' : `Saved${favoritesCount ? ` · ${favoritesCount}` : ''}`}
          </button>
        );
      })}
    </div>
  ) : null;

  let body: React.ReactNode;

  if (loading) {
    body = (
      <div className={`divide-y ${c.divide}`}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <div className="skeleton shrink-0 h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 rounded-full" style={{ width: `${70 - i * 5}%` }} />
              <div className="skeleton h-2.5 w-1/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (isFavoritesTab && results.length === 0) {
    body = (
      <div className="animate-fade-up px-6 py-8 flex flex-col items-center text-center">
        <div className={`h-11 w-11 rounded-xl grid place-items-center mb-3 ${c.panel}`}>
          <Heart size={19} className={c.muted} />
        </div>
        <p className={`text-[13px] font-bold ${c.text}`}>Nothing saved yet</p>
        <p className={`text-[11px] font-medium mt-0.5 ${c.muted}`}>tap the heart on a carpark</p>
      </div>
    );
  } else if (!hasSearched && !isFavoritesTab) {
    body = (
      <div className="animate-fade-up px-6 py-8 flex flex-col items-center text-center">
        <div className={`h-11 w-11 rounded-xl grid place-items-center mb-3 ${c.panel}`}>
          <Search size={19} className={c.muted} />
        </div>
        <p className={`text-[13px] font-bold ${c.text}`}>Where are you parking?</p>
        <p className={`text-[11px] font-medium mt-0.5 ${c.muted}`}>search somewhere to see carparks</p>
      </div>
    );
  } else if (results.length === 0) {
    body = (
      <p className={`animate-fade-up px-4 py-8 text-center text-[13px] font-semibold ${c.muted}`}>
        no carparks match the filters
      </p>
    );
  } else {
    body = (
      <div className={`stagger divide-y ${c.divide}`}>
        {results.map(cp => (
          <MobileResultRow key={cp.id} cp={cp} darkMode={darkMode} dense={dense}
            selected={selectedId === cp.id} isFav={favorites.has(cp.id)} canFavorite={canFavorite}
            vehicleType={vehicleType} recommended={!isFavoritesTab && cp.id === recommendedId}
            onSelect={() => onSelectCarpark(cp.id)}
            onToggleFav={e => { e.stopPropagation(); onToggleFav(e, cp.id); }} />
        ))}
      </div>
    );
  }

  return (
    <>
      {tabs}
      {body}
    </>
  );
}

interface SummaryProps {
  darkMode: boolean;
  hasSearched: boolean;
  loading: boolean;
  count: number;
  destination?: string;
  weather: string;
  weatherEmoji: string;
  temp: number | null;
  hidden: boolean;
  liveState: 'connecting' | 'live' | 'polling';
  favoritesView?: boolean;
  favoritesCount?: number;
}

export function SheetSummary({ darkMode, hasSearched, loading, count, destination, weather, weatherEmoji, temp, hidden, liveState, favoritesView, favoritesCount = 0 }: SummaryProps) {
  const c = cockpit(darkMode);
  if (hidden) return null;

  if (favoritesView) {
    return (
      <div className="flex items-center gap-2.5 px-4 pt-1 pb-2">
        <span className="shrink-0 grid place-items-center min-w-11 h-11 px-2.5 rounded-2xl bg-red-500 text-white text-2xl font-black leading-none tabular-nums shadow-sm">
          {favoritesCount}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-black leading-tight ${c.text}`}>Saved carpark{favoritesCount === 1 ? '' : 's'}</p>
          <p className={`text-[11px] font-medium leading-tight ${c.muted}`}>Tap one to route there</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 pt-1 pb-2">
      {hasSearched ? (
        <>
          <span key={count}
            className="animate-count-pop shrink-0 grid place-items-center min-w-11 h-11 px-2.5 rounded-2xl bg-yellow-400 text-[#0d1013] text-2xl font-black leading-none tabular-nums shadow-sm">
            {loading ? '·' : count}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-[15px] font-black leading-tight ${c.text}`}>
              {loading ? 'Finding parking...' : `carpark${count === 1 ? '' : 's'} nearby`}
            </p>
            {destination && (
              <p className={`text-[11px] font-medium leading-tight truncate ${c.muted}`}>{destination}</p>
            )}
          </div>
          {!loading && (
            <span className="shrink-0 flex items-center gap-1"
              title={liveState === 'live' ? 'live updates on' : 'live feed down, polling instead'}>
              <span className={`h-1.5 w-1.5 rounded-full ${liveState === 'live' ? 'bg-[#22c55e] live-pulse' : 'bg-[#f59e0b]'}`} />
              <span className={`text-[10px] font-black uppercase tracking-wider ${liveState === 'live' ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
                {liveState === 'live' ? 'Live' : 'Sync'}
              </span>
            </span>
          )}
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className={`text-[15px] font-black leading-tight ${c.text}`}>Find parking</p>
            <p className={`text-[11px] font-medium leading-tight ${c.muted}`}>Search a destination to start</p>
          </div>
          <div className={`shrink-0 flex items-center gap-1 h-7 px-2.5 rounded-full ${c.panel}`}>
            <span className="text-xs leading-none">{weatherEmoji}</span>
            <span className={`text-[11px] font-bold ${c.text}`}>{temp != null ? `${temp}°` : weather}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function LocateButton({ darkMode, className, offset, dragging, visible = true, active, onClick }: {
  darkMode: boolean; className: string; offset?: number; dragging?: boolean; visible?: boolean;
  active: boolean; onClick: () => void;
}) {
  const c = cockpit(darkMode);

  return (
    <button onClick={onClick}
      style={lift(offset, dragging)}
      className={`animate-fade-scale absolute z-30 h-11 w-11 grid place-items-center rounded-xl shadow-xl border ${c.raised} ${c.line} ${className} ${darkMode ? 'shadow-black/50' : 'shadow-black/15'} ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <LocateFixed size={18} className={active ? 'text-[#4285f4]' : 'text-red-400 gps-blink'} />
    </button>
  );
}

export function ReopenPill({ darkMode, hasSearched, count, onClick }: {
  darkMode: boolean; hasSearched: boolean; count: number; onClick: () => void;
}) {
  const c = cockpit(darkMode);
  const label = hasSearched ? `${count} ${count === 1 ? 'carpark' : 'carparks'}` : 'Search parking';

  return (
    <button onClick={onClick}
      className={`animate-fade-scale absolute z-30 left-1/2 -translate-x-1/2 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2 h-11 px-5 rounded-full shadow-xl border ${c.raised} ${c.line} ${darkMode ? 'shadow-black/50' : 'shadow-black/15'}`}>
      <ChevronUp size={16} className="text-yellow-500" />
      <span className={`text-[13px] font-black ${c.text}`}>{label}</span>
    </button>
  );
}
