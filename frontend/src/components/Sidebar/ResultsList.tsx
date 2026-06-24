import { CarparkCard } from '../CarparkCard';
import { formatParkDuration } from '../../utils/format';
import { LOT_LABELS } from '../../utils/constants';
import type { CarparkSummary } from '../../types';

interface Props {
  darkMode: boolean;
  hasSearched: boolean;
  searchResults: (CarparkSummary & { estimatedCost?: number | null })[];
  selectedId: string | null;
  favorites: Set<string>;
  vehicleType: string;
  durationHours: number;
  resultTab: 'avail' | 'other';
  setResultTab: (t: 'avail' | 'other') => void;
  onSelectCarpark: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}

export function ResultsList({
  darkMode, hasSearched, searchResults, selectedId, favorites,
  vehicleType, durationHours, resultTab, setResultTab,
  onSelectCarpark, onToggleFav,
}: Props) {
  const dm = darkMode;

  if (!hasSearched) {
    return <p className={`text-sm font-bold italic text-center py-8 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Search for a destination to find nearby parking.</p>;
  }

  const withAvail = searchResults.filter(cp => Object.keys(cp.availability).length > 0);
  const noAvail = searchResults.filter(cp => Object.keys(cp.availability).length === 0);
  const showing = resultTab === 'avail' ? withAvail : noAvail;

  return (
    <div className="p-3 space-y-2">
      <div className={`flex items-center gap-1 pb-2 mb-1 border-b-2 border-dashed ${dm ? 'border-neutral-600' : 'border-gray-200'}`}>
        <button onClick={() => setResultTab('avail')}
          className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition ${
            resultTab === 'avail' ? 'bg-green-600 text-white' : dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'
          }`}>
          Available ({withAvail.length})
        </button>
        <button onClick={() => setResultTab('other')}
          className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition ${
            resultTab === 'other' ? 'bg-gray-500 text-white' : dm ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'
          }`}>
          No Data ({noAvail.length})
        </button>
        <span className={`text-[9px] font-bold ml-auto ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
          {formatParkDuration(durationHours)} &middot; {LOT_LABELS[vehicleType] || vehicleType}
        </span>
      </div>
      {showing.map(cp => (
        <CarparkCard key={cp.id} cp={cp} selected={selectedId === cp.id}
          isFav={favorites.has(cp.id)} darkMode={dm} vehicleType={vehicleType}
          onSelect={() => onSelectCarpark(cp.id)}
          onToggleFav={e => onToggleFav(e, cp.id)} />
      ))}
    </div>
  );
}
