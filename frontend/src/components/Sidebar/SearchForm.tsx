import { Navigation, Search, X, Crosshair } from 'lucide-react';
import { SuggestionList, useSuggestionKeys } from '../SuggestionList';
import { DurationChips } from '../DurationChips';
import { VEHICLE_OPTIONS } from '../../utils/constants';
import { formatTime12, parseClockTime } from '../../utils/format';
import type { PlaceSuggestion } from '../../types';

interface Props {
  darkMode: boolean;
  destination: string;
  onDestinationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  suggestions: PlaceSuggestion[];
  isDropdownOpen: boolean;
  closeDropdown: () => void;
  onSelectSuggestion: (s: PlaceSuggestion) => void;
  startPoint: string;
  onStartChange: (val: string) => void;
  startCoords: [number, number] | null;
  clearStart: () => void;
  startSuggestions: PlaceSuggestion[];
  startDropdownOpen: boolean;
  closeStartDropdown: () => void;
  onSelectStart: (s: PlaceSuggestion) => void;
  onStartSubmit: () => void;
  locationShared: boolean;
  arrivalTime: Date;
  parkUntil: string;
  setParkUntil: (v: string) => void;
  vehicleType: string;
  setVehicleType: (v: string) => void;
  maxPrice: number | null;
  setMaxPrice: (v: number | null) => void;
  costRange: { min: number; max: number };
  loading: boolean;
  onSubmit: (q: string) => void;
  onPickStart: () => void;
  onPickDestination: () => void;
}

export function SearchForm({
  darkMode, destination, onDestinationChange,
  suggestions, isDropdownOpen, closeDropdown, onSelectSuggestion,
  startPoint, onStartChange, startCoords, clearStart,
  startSuggestions, startDropdownOpen, closeStartDropdown, onSelectStart, onStartSubmit,
  locationShared, arrivalTime, parkUntil, setParkUntil,
  vehicleType, setVehicleType, maxPrice, setMaxPrice, costRange,
  loading, onSubmit, onPickStart, onPickDestination,
}: Props) {
  const dm = darkMode;
  const inputBg = dm ? 'bg-neutral-800/60 border border-neutral-600/50' : 'bg-white/60 border border-gray-300';
  const inputText = dm ? 'text-gray-100' : 'text-gray-800';
  const labelClass = `text-[11px] font-black uppercase tracking-widest mb-1 block ${dm ? 'text-gray-500' : 'text-gray-400'}`;
  const pickBtn = `shrink-0 p-2 -my-1 rounded-lg transition ${dm ? 'text-gray-400 hover:text-blue-400 hover:bg-neutral-700/50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50/60'}`;

  const submitTyped = () => {
    closeDropdown();
    closeStartDropdown();
    onSubmit(destination);
  };

  const destKeys = useSuggestionKeys(suggestions, isDropdownOpen, onSelectSuggestion, submitTyped, closeDropdown);
  const startKeys = useSuggestionKeys(startSuggestions, startDropdownOpen, onSelectStart, () => { closeStartDropdown(); onStartSubmit(); }, closeStartDropdown);

  return (
    <div className={`px-3 py-3 border-b shrink-0 ${dm ? 'bg-neutral-900 border-neutral-700/40' : 'bg-white border-gray-200/30'}`}>
      <form onSubmit={e => { e.preventDefault(); submitTyped(); }} className="space-y-2.5">
        <div className="relative">
          <label className={labelClass}>Start</label>
          <div className={`flex items-center rounded-xl px-2.5 py-2 transition ${inputBg} ${startCoords ? 'border-green-500/50' : 'focus-within:border-blue-500/50'}`}>
            <Navigation className={`mr-2 shrink-0 ${startCoords ? 'text-green-500' : 'text-blue-500'}`} size={15} />
            <input type="text" value={startPoint}
              onChange={e => onStartChange(e.target.value)}
              onKeyDown={startKeys.onKeyDown}
              onBlur={() => setTimeout(closeStartDropdown, 150)}
              placeholder={locationShared ? 'Current location' : 'Current location (allow GPS)'}
              className={`bg-transparent w-full outline-none text-base md:text-sm font-bold placeholder-gray-400 ${inputText}`} />
            <button type="button" onClick={onPickStart} className={pickBtn} title="Pick from map">
              <Crosshair size={14} />
            </button>
            {startCoords && (
              <button type="button" onClick={clearStart} className="text-gray-400 hover:text-gray-600 ml-0.5 shrink-0"><X size={14} /></button>
            )}
          </div>
          {startDropdownOpen && startSuggestions.length > 0 && (
            <SuggestionList items={startSuggestions} onSelect={onSelectStart} darkMode={dm}
              activeIndex={startKeys.activeIndex} onHover={startKeys.setActiveIndex} />
          )}
        </div>

        <div className="relative">
          <label className={labelClass}>Destination</label>
          <div className={`flex items-center rounded-xl px-2.5 py-2 focus-within:border-blue-500/50 transition ${inputBg}`}>
            <Search className="text-gray-400 mr-2 shrink-0" size={15} />
            <input required type="text" value={destination}
              onChange={onDestinationChange}
              onKeyDown={destKeys.onKeyDown}
              onBlur={() => setTimeout(closeDropdown, 150)}
              placeholder="e.g. Orchard Gateway"
              className={`bg-transparent w-full outline-none text-base md:text-sm font-bold placeholder-gray-400 ${inputText}`} />
            <button type="button" onClick={onPickDestination} className={pickBtn} title="Pick from map">
              <Crosshair size={14} />
            </button>
          </div>
          {isDropdownOpen && suggestions.length > 0 && (
            <SuggestionList items={suggestions} onSelect={onSelectSuggestion} darkMode={dm}
              activeIndex={destKeys.activeIndex} onHover={destKeys.setActiveIndex} />
          )}
        </div>

        <div>
          <label className={labelClass}>Park from {formatTime12(arrivalTime)} → {formatTime12(parseClockTime(parkUntil))}</label>
          <DurationChips arrivalTime={arrivalTime} parkUntil={parkUntil} setParkUntil={setParkUntil} dm={dm} />
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className={labelClass}>Vehicle</label>
            <div className="flex gap-1.5">
              {VEHICLE_OPTIONS.map(([code, Icon, label]) => (
                <button key={code} type="button" onClick={() => setVehicleType(code)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition ${
                    vehicleType === code
                      ? dm ? 'bg-blue-600/80 border-blue-500 text-white' : 'bg-gray-900 border-gray-900 text-white'
                      : dm ? 'bg-neutral-800/60 border-neutral-600/50 text-gray-400 hover:border-gray-400' : 'bg-white/50 border-gray-200/50 text-gray-500 hover:border-gray-400'
                  }`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass + ' !mb-0'}>Budget <span className={`${maxPrice === null ? 'text-green-500' : dm ? 'text-gray-300' : 'text-gray-600'}`}>{maxPrice === null ? 'Any' : `≤$${maxPrice}`}</span></label>
            {maxPrice !== null && <button type="button" onClick={() => setMaxPrice(null)} className={`text-[9px] font-bold ${dm ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>Reset</button>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>${costRange.min}</span>
            <input type="range" min={costRange.min} max={costRange.max} step={1}
              value={maxPrice ?? costRange.max}
              onChange={e => { const v = Number(e.target.value); setMaxPrice(v >= costRange.max ? null : v); }}
              className="budget-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ background: '#3b82f6' }} />
            <span className={`text-[10px] font-bold shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>${costRange.max}+</span>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-2.5 rounded-xl shadow-[0_3px_0_rgb(180,140,0)] active:shadow-none active:translate-y-0.5 transition text-sm disabled:opacity-50">
          {loading ? 'Searching...' : 'Find Parking'}
        </button>
      </form>
    </div>
  );
}
