import { useState } from 'react';
import { addFavorite, removeFavorite } from '../providers/favorites';
import type { AppState } from '../types';

export function useFavorites(appState: AppState) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const loadFavorites = (ids: string[]) => setFavorites(new Set(ids));

  const toggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (appState !== 'user') { alert('Log in to save favorites'); return; }
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); removeFavorite(id).catch(() => {}); }
      else { next.add(id); addFavorite(id).catch(() => {}); }
      return next;
    });
  };

  const clearFavorites = () => setFavorites(new Set());

  return { favorites, loadFavorites, toggleFav, clearFavorites };
}
