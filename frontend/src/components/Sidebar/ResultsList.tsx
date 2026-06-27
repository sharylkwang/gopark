import { CarparkCard } from '../CarparkCard';
import type { CarparkSummary } from '../../types';

interface Props {
  darkMode: boolean;
  hasSearched: boolean;
  searchResults: (CarparkSummary & { estimatedCost?: number | null })[];
  selectedId: string | null;
  favorites: Set<string>;
  vehicleType: string;
  durationHours: number;
  onSelectCarpark: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}

export function ResultsList({
  darkMode, hasSearched, searchResults, selectedId, favorites,
  vehicleType,
  onSelectCarpark, onToggleFav,
}: Props) {
  const dm = darkMode;

  if (!hasSearched) {
    return <p className={`text-sm font-bold italic text-center py-8 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Search for a destination to find nearby parking.</p>;
  }

  return (
    <div className="p-3 space-y-2">
      {searchResults.map((cp, i) => (
        <CarparkCard key={cp.id} cp={cp} selected={selectedId === cp.id}
          isFav={favorites.has(cp.id)} darkMode={dm} vehicleType={vehicleType}
          recommended={i === 0}
          onSelect={() => onSelectCarpark(cp.id)}
          onToggleFav={e => onToggleFav(e, cp.id)} />
      ))}
    </div>
  );
}
