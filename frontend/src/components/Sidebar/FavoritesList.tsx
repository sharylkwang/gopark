import { CarparkCard } from '../CarparkCard';
import type { CarparkSummary } from '../../types';

interface Props {
  darkMode: boolean;
  allCarparks: CarparkSummary[];
  favorites: Set<string>;
  selectedId: string | null;
  onSelectCarpark: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
}

export function FavoritesList({ darkMode, allCarparks, favorites, selectedId, onSelectCarpark, onToggleFav }: Props) {
  const favCarparks = allCarparks.filter(cp => favorites.has(cp.id));

  if (favCarparks.length === 0) {
    return <p className={`text-sm font-bold italic text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>no favorites yet, tap the heart on a carpark to save it</p>;
  }

  return (
    <div className="p-3 space-y-2">
      {favCarparks.map(cp => (
        <CarparkCard key={cp.id} cp={cp} selected={selectedId === cp.id}
          isFav darkMode={darkMode}
          onSelect={() => onSelectCarpark(cp.id)}
          onToggleFav={e => onToggleFav(e, cp.id)} />
      ))}
    </div>
  );
}
