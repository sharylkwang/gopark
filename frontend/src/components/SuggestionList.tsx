import { useRef, useCallback, useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { PlaceSuggestion } from '../types';

const PAGE_SIZE = 10;

interface Props {
  items: PlaceSuggestion[];
  onSelect: (s: PlaceSuggestion) => void;
  darkMode: boolean;
  activeIndex: number;
  onHover: (i: number) => void;
}

export function SuggestionList({ items, onSelect, darkMode, activeIndex, onHover }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [items]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || visibleCount >= items.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setVisibleCount(v => Math.min(v + PAGE_SIZE, items.length));
  }, [visibleCount, items.length]);

  return (
    <ul ref={listRef} onScroll={handleScroll}
      className={`absolute top-full left-0 w-full mt-1 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto overscroll-contain sidebar-scroll ${
        darkMode ? 'bg-neutral-800/95 backdrop-blur-xl border border-neutral-600/50' : 'bg-white/95 backdrop-blur-xl border border-gray-200/50'
      }`}>
      {items.slice(0, visibleCount).map((s, i) => (
        <li key={`${s.lat},${s.lon},${i}`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => onSelect(s)}
          onMouseEnter={() => onHover(i)}
          className={`px-3 py-3 cursor-pointer last:border-0 text-sm font-bold flex items-center gap-2.5 ${
            i === activeIndex
              ? darkMode ? 'bg-neutral-700/70 text-white' : 'bg-blue-50 text-gray-900'
              : darkMode ? 'border-b border-neutral-700/50 text-gray-200' : 'border-b border-gray-100/60 text-gray-700'
          }`}>
          <MapPin size={14} className={`shrink-0 ${i === activeIndex ? 'text-blue-500' : 'text-gray-400'}`} />
          <span className="truncate">{s.formatted || s.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function useSuggestionKeys(items: PlaceSuggestion[], isOpen: boolean, onSelect: (s: PlaceSuggestion) => void, onSubmit: () => void, onClose: () => void) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => { setActiveIndex(-1); }, [items, isOpen]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { onClose(); return; }

    const usable = isOpen && items.length > 0;
    if (e.key === 'ArrowDown' && usable) { e.preventDefault(); setActiveIndex(i => (i + 1) % items.length); return; }
    if (e.key === 'ArrowUp' && usable) { e.preventDefault(); setActiveIndex(i => (i <= 0 ? items.length - 1 : i - 1)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (usable && activeIndex >= 0) onSelect(items[activeIndex]);
      else onSubmit();
    }
  };

  return { activeIndex, setActiveIndex, onKeyDown };
}
