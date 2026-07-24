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
  recommendedId: string | null;
  canFavorite?: boolean;
  onSelectCarpark: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}

export function ResultsList({
  darkMode, hasSearched, searchResults, selectedId, favorites,
  vehicleType, recommendedId, canFavorite = true,
  onSelectCarpark, onToggleFav,
}: Props) {
  const dm = darkMode;

  if (!hasSearched) {
    return <p className={`animate-fade-up text-sm font-bold italic text-center py-8 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Search for a destination to find nearby parking.</p>;
  }

  return (
    <div className="stagger p-3 space-y-2">
      {searchResults.map(cp => (
        <CarparkCard key={cp.id} cp={cp} selected={selectedId === cp.id}
          isFav={favorites.has(cp.id)} canFavorite={canFavorite} darkMode={dm} vehicleType={vehicleType}
          recommended={cp.id === recommendedId}
          onSelect={() => onSelectCarpark(cp.id)}
          onToggleFav={e => onToggleFav(e, cp.id)} />
      ))}
    </div>
  );
}
