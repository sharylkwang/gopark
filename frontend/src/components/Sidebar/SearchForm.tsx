import { Navigation, Search, Clock, X, Crosshair } from 'lucide-react';
import { SuggestionList, useSuggestionKeys } from '../SuggestionList';
import { VEHICLE_OPTIONS } from '../../utils/constants';
import { formatClockTime, formatTime12, parseClockTime } from '../../utils/format';
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
  startSuggestions, startDropdownOpen, closeStartDropdown, onSelectStart,
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
  const startKeys = useSuggestionKeys(startSuggestions, startDropdownOpen, onSelectStart, () => closeStartDropdown(), closeStartDropdown);

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
              onFocus={() => !submitted.current && destination.length > 2 && setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
              placeholder="e.g. Orchard Gateway"
              className={`bg-transparent w-full outline-none text-sm font-bold placeholder-gray-400 ${inputText}`} />
            <button type="button" onClick={onPickDestination} className={pickBtn} title="Pick from map">
              <Crosshair size={14} />
            </button>
          </div>
          {isDropdownOpen && suggestions.length > 0 && (
            <SuggestionList items={suggestions} onSelect={onSelectSuggestion} darkMode={dm} />
          )}
        </div>

        <div>
          <label className={labelClass}>Park from {formatTime12(arrivalTime)} → {formatTime12(parseClockTime(parkUntil))}</label>
          <div className="flex gap-1.5">
            {[0.5, 1, 2, 3, 4, 6].map(h => {
              const target = new Date(arrivalTime.getTime() + h * 3600000);
              const val = formatClockTime(target);
              const active = parkUntil === val;
              return (
                <button key={h} type="button" onClick={() => setParkUntil(val)}
                  className={`flex-1 py-1.5 rounded-xl border text-[11px] font-black transition ${
                    active
                      ? dm ? 'bg-blue-600/80 border-blue-500 text-white' : 'bg-gray-900 border-gray-900 text-white'
                      : dm ? 'bg-neutral-800/60 border-neutral-600/50 text-gray-400 hover:border-gray-400' : 'bg-white/50 border-gray-200/50 text-gray-500 hover:border-gray-400'
                  }`}>
                  {h < 1 ? '30m' : `${h}h`}
                </button>
              );
            })}
            <div className={`flex-1 relative rounded-xl border text-[11px] font-black ${dm ? 'bg-neutral-800/60 border-neutral-600/50 text-gray-400' : 'bg-white/50 border-gray-200/50 text-gray-500'}`}>
              <span className="flex items-center justify-center h-full pointer-events-none">
                <Clock size={11} className="mr-0.5" />Set
              </span>
              <input type="time" value={parkUntil} onChange={e => setParkUntil(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>
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

const PAGE_SIZE = 10;

function SuggestionList({ items, onSelect, darkMode }: {
  items: PlaceSuggestion[]; onSelect: (s: PlaceSuggestion) => void; darkMode: boolean;
}) {
  const [hovered, setHovered] = useState(-1);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLUListElement>(null);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || visibleCount >= items.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setVisibleCount(v => Math.min(v + PAGE_SIZE, items.length));
    }
  }, [visibleCount, items.length]);

  const visible = items.slice(0, visibleCount);
  const active = hovered >= 0 ? hovered : 0;

  return (
    <ul ref={listRef} onScroll={handleScroll}
      className={`absolute top-full left-0 w-full mt-1 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto sidebar-scroll ${darkMode ? 'bg-neutral-800/95 backdrop-blur-xl border border-neutral-600/50' : 'bg-white/95 backdrop-blur-xl border border-gray-200/50'}`}>
      {visible.map((s, i) => (
        <li key={i}
          onClick={() => onSelect(s)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(-1)}
          className={`px-3 py-2.5 cursor-pointer last:border-0 text-sm font-bold flex items-center gap-2 ${
            i === active
              ? darkMode ? 'bg-neutral-700/70 text-white' : 'bg-blue-50 text-gray-900'
              : darkMode ? 'border-b border-neutral-700/50 text-gray-200' : 'border-b border-gray-100/50 text-gray-700'
          }`}>
          <MapPin size={13} className={`flex-shrink-0 ${i === active ? 'text-blue-500' : 'text-gray-400'}`} />
          <span className="truncate">{s.formatted || s.name}</span>
        </li>
      ))}
    </ul>
  );
}
