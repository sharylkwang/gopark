import { Navigation, Search, Clock, MapPin, X } from 'lucide-react';
import { formatParkDuration } from '../../utils/format';
import { VEHICLE_OPTIONS, BUDGET_OPTIONS } from '../../utils/constants';
import type { PlaceSuggestion } from '../../types';

interface Props {
  darkMode: boolean;
  destination: string;
  onDestinationChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  suggestions: PlaceSuggestion[];
  isDropdownOpen: boolean;
  setIsDropdownOpen: (v: boolean) => void;
  onSelectSuggestion: (s: PlaceSuggestion) => void;
  startPoint: string;
  onStartChange: (val: string) => void;
  startCoords: [number, number] | null;
  clearStart: () => void;
  startSuggestions: PlaceSuggestion[];
  startDropdownOpen: boolean;
  setStartDropdownOpen: (v: boolean) => void;
  onSelectStart: (s: PlaceSuggestion) => void;
  locationShared: boolean;
  parkUntil: string;
  setParkUntil: (v: string) => void;
  durationHours: number;
  vehicleType: string;
  setVehicleType: (v: string) => void;
  maxPrice: number | null;
  setMaxPrice: (v: number | null) => void;
  loading: boolean;
  onSubmit: (q: string) => void;
}

export function SearchForm({
  darkMode, destination, onDestinationChange,
  suggestions, isDropdownOpen, setIsDropdownOpen, onSelectSuggestion,
  startPoint, onStartChange, startCoords, clearStart,
  startSuggestions, startDropdownOpen, setStartDropdownOpen, onSelectStart,
  locationShared, parkUntil, setParkUntil, durationHours,
  vehicleType, setVehicleType, maxPrice, setMaxPrice,
  loading, onSubmit,
}: Props) {
  const dm = darkMode;
  const inputBg = dm ? 'bg-neutral-800 border border-neutral-600' : 'bg-gray-50 border border-gray-200';
  const inputText = dm ? 'text-gray-100' : 'text-gray-800';
  const labelClass = `text-[10px] font-black uppercase tracking-widest mb-1 block ${dm ? 'text-gray-400' : 'text-gray-500'}`;

  return (
    <div className={`p-4 border-b shrink-0 ${dm ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'}`}>
      <form onSubmit={e => { e.preventDefault(); onSubmit(destination); }} className="space-y-3">
        <div className="relative">
          <label className={labelClass}>Start Point</label>
          <div className={`flex items-center rounded-lg p-2.5 transition ${inputBg} ${startCoords ? 'border-green-500' : 'focus-within:border-blue-500'}`}>
            <Navigation className={`mr-2 shrink-0 ${startCoords ? 'text-green-500' : 'text-blue-500'}`} size={16} />
            <input type="text" value={startPoint}
              onChange={e => onStartChange(e.target.value)}
              onFocus={() => startPoint.length > 2 && setStartDropdownOpen(true)}
              onBlur={() => setTimeout(() => setStartDropdownOpen(false), 200)}
              placeholder={locationShared ? 'Using your location' : 'Optional — set a start point'}
              className={`bg-transparent w-full outline-none text-sm font-bold placeholder-gray-400 ${inputText}`} />
            {startCoords && (
              <button type="button" onClick={clearStart} className="text-gray-400 hover:text-red-500 ml-1 shrink-0"><X size={14} /></button>
            )}
          </div>
          {startDropdownOpen && startSuggestions.length > 0 && (
            <SuggestionList items={startSuggestions} onSelect={onSelectStart} darkMode={dm} color="blue" />
          )}
        </div>

        <div className="relative">
          <label className={labelClass}>Destination</label>
          <div className={`flex items-center rounded-lg p-2.5 focus-within:border-red-500 transition ${inputBg}`}>
            <Search className="text-red-500 mr-2 shrink-0" size={18} />
            <input required type="text" value={destination}
              onChange={onDestinationChange}
              onFocus={() => destination.length > 2 && setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              placeholder="e.g. Orchard Gateway"
              className={`bg-transparent w-full outline-none text-sm font-bold placeholder-gray-400 ${inputText}`} />
          </div>
          {isDropdownOpen && suggestions.length > 0 && (
            <SuggestionList items={suggestions} onSelect={onSelectSuggestion} darkMode={dm} color="red" />
          )}
        </div>

        <div>
          <label className={labelClass}>Park Until</label>
          <div className="flex gap-2 items-center">
            <div className={`flex-1 flex items-center rounded-lg p-2.5 focus-within:border-red-500 transition ${inputBg}`}>
              <Clock className="text-red-500 mr-2 shrink-0" size={16} />
              <input type="time" value={parkUntil} onChange={e => setParkUntil(e.target.value)}
                className={`bg-transparent w-full outline-none text-sm font-bold cursor-pointer ${inputText}`} />
            </div>
            <div className={`shrink-0 text-center rounded-lg px-3 py-2 ${dm ? 'bg-neutral-800 border border-neutral-600' : 'bg-blue-50 border border-blue-200'}`}>
              <p className={`text-sm font-black ${dm ? 'text-gray-100' : 'text-blue-700'}`}>{formatParkDuration(durationHours)}</p>
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>Vehicle</label>
          <div className="flex gap-1.5">
            {VEHICLE_OPTIONS.map(([code, Icon, label]) => (
              <button key={code} type="button" onClick={() => setVehicleType(code)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-[10px] font-black uppercase tracking-wider transition ${
                  vehicleType === code
                    ? 'bg-red-600 border-red-600 text-white'
                    : dm ? 'bg-neutral-800 border-neutral-600 text-gray-300 hover:border-red-400' : 'bg-white border-gray-200 text-gray-500 hover:border-red-400'
                }`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Max Budget {maxPrice !== null ? `— $${maxPrice}` : '— Any'}</label>
          <div className="flex gap-1.5 flex-wrap">
            {BUDGET_OPTIONS.map(price => (
              <button key={String(price)} type="button" onClick={() => setMaxPrice(price)}
                className={`px-3 py-1.5 rounded-lg border-2 text-[10px] font-black transition ${
                  maxPrice === price
                    ? 'bg-green-600 border-green-600 text-white'
                    : dm ? 'bg-neutral-800 border-neutral-600 text-gray-300 hover:border-green-400' : 'bg-white border-gray-200 text-gray-500 hover:border-green-400'
                }`}>
                {price === null ? 'Any' : `≤$${price}`}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-black uppercase tracking-widest py-3 rounded-lg shadow-[0_4px_0_rgb(180,140,0)] active:shadow-none active:translate-y-1 transition text-sm disabled:opacity-50">
          {loading ? 'Searching...' : 'Find Parking'}
        </button>
      </form>
    </div>
  );
}

function SuggestionList({ items, onSelect, darkMode, color }: {
  items: PlaceSuggestion[]; onSelect: (s: PlaceSuggestion) => void; darkMode: boolean; color: 'blue' | 'red';
}) {
  const hoverBg = color === 'blue' ? (darkMode ? 'hover:bg-neutral-700' : 'hover:bg-blue-50') : (darkMode ? 'hover:bg-neutral-700' : 'hover:bg-red-50');
  return (
    <ul className={`absolute top-full left-0 w-full mt-1 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto ${darkMode ? 'bg-neutral-800 border border-neutral-600' : 'bg-white border border-gray-200'}`}>
      {items.map((s, i) => (
        <li key={i} onClick={() => onSelect(s)}
          className={`px-4 py-3 cursor-pointer last:border-0 text-sm font-bold flex items-center gap-2 ${hoverBg} ${darkMode ? 'border-b border-neutral-700 text-gray-200' : 'border-b border-gray-100 text-gray-700'}`}>
          <MapPin size={14} className={`text-${color}-400 flex-shrink-0`} />
          <span className="truncate">{s.formatted || s.name}</span>
        </li>
      ))}
    </ul>
  );
}
