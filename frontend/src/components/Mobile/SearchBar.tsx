import { useState } from 'react';
import { Search, X, MoreVertical, Moon, Sun, LogOut, Home, Navigation, Crosshair, ArrowRight, LocateFixed } from 'lucide-react';
import { SuggestionList, useSuggestionKeys } from '../SuggestionList';
import { cockpit } from './theme';
import type { PlaceSuggestion } from '../../types';

interface Props {
  className?: string;
  dense?: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;

  destination: string;
  onDestinationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  suggestions: PlaceSuggestion[];
  isDropdownOpen: boolean;
  closeDropdown: () => void;
  onSelectSuggestion: (s: PlaceSuggestion) => void;
  onSubmit: (q: string) => void;
  onPickDestination: () => void;
  onClear: () => void;

  startPoint: string;
  onStartChange: (v: string) => void;
  startCoords: [number, number] | null;
  clearStart: () => void;
  startSuggestions: PlaceSuggestion[];
  startDropdownOpen: boolean;
  closeStartDropdown: () => void;
  onSelectStart: (s: PlaceSuggestion) => void;
  onStartSubmit: () => void;
  onPickStart: () => void;

  onLogout: () => void;
  onReset: () => void;
  locationShared: boolean;
  onShareLocation: () => void;
}

export function MobileSearchBar({
  className = '', dense = false, darkMode, toggleDarkMode,
  destination, onDestinationChange, suggestions, isDropdownOpen, closeDropdown,
  onSelectSuggestion, onSubmit, onPickDestination, onClear,
  startPoint, onStartChange, startCoords, clearStart,
  startSuggestions, startDropdownOpen, closeStartDropdown, onSelectStart, onStartSubmit, onPickStart,
  onLogout, onReset, locationShared, onShareLocation,
}: Props) {
  const c = cockpit(darkMode);
  const [menuOpen, setMenuOpen] = useState(false);

  const submitTyped = () => {
    closeDropdown();
    onSubmit(destination);
  };

  const destKeys = useSuggestionKeys(suggestions, isDropdownOpen, onSelectSuggestion, submitTyped, closeDropdown);
  const startKeys = useSuggestionKeys(startSuggestions, startDropdownOpen, onSelectStart, () => { closeStartDropdown(); onStartSubmit(); }, closeStartDropdown);

  const input = `flex-1 min-w-0 bg-transparent outline-none text-[16px] font-semibold ${c.text} ${
    darkMode ? 'placeholder:text-[#8b95a3]' : 'placeholder:text-gray-400'
  } placeholder:font-medium`;
  const iconBtn = `shrink-0 h-9 w-9 grid place-items-center rounded-lg ${c.muted}`;
  const menuItem = `flex items-center gap-3 w-full px-4 py-3 text-left text-sm font-semibold ${c.text}`;

  return (
    <div className={`animate-fade-up ${className}`}>
      <div className={`relative rounded-2xl shadow-xl ${c.raised} ${darkMode ? 'shadow-black/50' : 'shadow-black/10'}`}>
        <div className={`flex items-center ${dense ? 'h-10' : 'h-12'} pl-3.5 pr-1.5`}>
          <span className="shrink-0 grid place-items-center w-5">
            <span className={`h-2.5 w-2.5 rounded-full ${startCoords ? 'bg-[#4285f4]' : 'bg-[#4285f4]/45'} ring-2 ring-[#4285f4]/20`} />
          </span>
          <input
            type="text"
            value={startPoint}
            onChange={e => onStartChange(e.target.value)}
            onKeyDown={startKeys.onKeyDown}
            onBlur={() => setTimeout(closeStartDropdown, 150)}
            placeholder="Your location"
            aria-label="Start point"
            className={`${input} h-full px-2.5`}
          />
          {startCoords ? (
            <button onClick={clearStart} aria-label="Use my location" className={iconBtn}>
              <X size={15} />
            </button>
          ) : (
            <button onClick={onShareLocation} aria-label="Use my location"
              className={`shrink-0 h-9 w-9 grid place-items-center rounded-lg ${locationShared ? c.muted : 'text-red-400 gps-blink'}`}>
              <LocateFixed size={15} />
            </button>
          )}
          <button onClick={onPickStart} aria-label="Pick start on map" className={iconBtn}>
            <Crosshair size={15} />
          </button>
        </div>

        {startDropdownOpen && startSuggestions.length > 0 && (
          <SuggestionList items={startSuggestions} onSelect={onSelectStart} darkMode={darkMode}
            activeIndex={startKeys.activeIndex} onHover={startKeys.setActiveIndex} />
        )}

        <div className={`mx-3.5 border-t ${c.line}`} />

        <div className={`flex items-center ${dense ? 'h-10' : 'h-12'} pl-3.5 pr-1.5`}>
          <span className="shrink-0 grid place-items-center w-5">
            <Search size={17} className={c.muted} />
          </span>
          <input
            type="text"
            value={destination}
            onChange={onDestinationChange}
            onKeyDown={destKeys.onKeyDown}
            onBlur={() => setTimeout(closeDropdown, 150)}
            enterKeyHint="search"
            placeholder="Where to?"
            aria-label="Destination"
            className={`${input} h-full px-2.5`}
          />
          {destination && (
            <button onClick={onClear} aria-label="Clear destination" className={iconBtn}>
              <X size={15} />
            </button>
          )}
          {destination.trim().length > 2 ? (
            <button onClick={submitTyped} aria-label="Search"
              className="animate-fade-scale press shrink-0 h-9 w-9 grid place-items-center rounded-lg bg-yellow-400 text-[#0d1013]">
              <ArrowRight size={16} strokeWidth={3} />
            </button>
          ) : (
            <button onClick={onPickDestination} aria-label="Pick destination on map" className={iconBtn}>
              <Crosshair size={15} />
            </button>
          )}
          <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu"
            className={`shrink-0 h-9 w-9 grid place-items-center rounded-lg ${menuOpen ? 'text-yellow-400' : c.muted}`}>
            <MoreVertical size={16} />
          </button>
        </div>

        {isDropdownOpen && suggestions.length > 0 && (
          <SuggestionList items={suggestions} onSelect={onSelectSuggestion} darkMode={darkMode}
            activeIndex={destKeys.activeIndex} onHover={destKeys.setActiveIndex} />
        )}

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className={`animate-drop-in absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden shadow-2xl z-50 origin-top-right border ${c.raised} ${c.line}`}>
              <button className={menuItem} onClick={() => { onReset(); setMenuOpen(false); }}>
                <Home size={18} className={c.muted} /> Home
              </button>
              {!locationShared && (
                <button className={menuItem} onClick={() => { onShareLocation(); setMenuOpen(false); }}>
                  <Navigation size={18} className="text-red-400" /> Share location
                </button>
              )}
              <button className={menuItem} onClick={() => { toggleDarkMode(); setMenuOpen(false); }}>
                {darkMode ? <Sun size={18} className={c.muted} /> : <Moon size={18} className={c.muted} />}
                {darkMode ? 'Light mode' : 'Dark mode'}
              </button>
              <button className={menuItem} onClick={() => { onLogout(); setMenuOpen(false); }}>
                <LogOut size={18} className={c.muted} /> Log out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
