import { useState } from 'react';
import { Clock, Wallet, Check } from 'lucide-react';
import { TimeRange } from './TimeRange';
import { VEHICLE_OPTIONS } from '../../utils/constants';
import { formatParkDuration } from '../../utils/format';
import { cockpit } from './theme';

type Panel = 'duration' | 'budget' | null;

interface Props {
  className?: string;
  darkMode: boolean;
  vehicleType: string;
  setVehicleType: (v: string) => void;
  arrivalTime: Date;
  parkUntil: string;
  setParkUntil: (v: string) => void;
  durationHours: number;
  maxPrice: number | null;
  setMaxPrice: (v: number | null) => void;
  costRange: { min: number; max: number };
  onPanelToggle?: (open: boolean) => void;
}

export function MobileChips({
  className = '', darkMode, vehicleType, setVehicleType,
  arrivalTime, parkUntil, setParkUntil, durationHours,
  maxPrice, setMaxPrice, costRange, onPanelToggle,
}: Props) {
  const c = cockpit(darkMode);
  const [panel, setPanel] = useState<Panel>(null);

  const show = (p: Panel) => {
    setPanel(p);
    onPanelToggle?.(p !== null);
  };

  const toggle = (p: Panel) => show(panel === p ? null : p);

  const chip = (active: boolean) =>
    `press flex-1 min-w-0 flex items-center justify-center gap-1.5 h-9 px-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
      active
        ? 'bg-yellow-400 border-yellow-400 text-[#0d1013]'
        : `${c.raised} ${c.line} ${c.text}`
    }`;

  return (
    <div className={`relative ${className}`}>
      {panel && (
        <div className="fixed inset-0 -z-10" onClick={() => show(null)} />
      )}

      <div className="flex gap-1.5">
        <div className={`shrink-0 flex items-center gap-0.5 h-9 p-0.5 rounded-full border ${c.raised} ${c.line}`}>
          {VEHICLE_OPTIONS.map(([code, Icon, label]) => (
            <button key={code} onClick={() => setVehicleType(code)}
              aria-label={label} title={label}
              className={`press h-8 w-9 grid place-items-center rounded-full transition-colors ${
                vehicleType === code ? 'bg-yellow-400 text-[#0d1013]' : c.muted
              }`}>
              <Icon size={16} />
            </button>
          ))}
        </div>

        <button onClick={() => toggle('duration')} className={chip(panel === 'duration')}>
          <Clock size={13} className="shrink-0" /><span className="truncate">{formatParkDuration(durationHours)}</span>
        </button>

        <button onClick={() => toggle('budget')} className={chip(panel === 'budget' || maxPrice !== null)}>
          <Wallet size={13} className="shrink-0" /><span className="truncate">{maxPrice === null ? 'Any price' : `≤ $${maxPrice}`}</span>
        </button>
      </div>

      {panel && (
        <div className={`animate-drop-in mt-2 rounded-2xl border p-3 shadow-xl ${c.raised} ${c.line}`}>
          {panel === 'duration' && (
            <>
              <Label c={c}>Parking for {formatParkDuration(durationHours)}</Label>
              <TimeRange c={c} darkMode={darkMode} arrivalTime={arrivalTime}
                parkUntil={parkUntil} setParkUntil={setParkUntil} />
            </>
          )}

          {panel === 'budget' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <Label c={c} inline>Max price</Label>
                <span className={`text-base font-black ${maxPrice === null ? 'text-[#22c55e]' : c.text}`}>
                  {maxPrice === null ? 'Any' : `≤ $${maxPrice}`}
                </span>
              </div>
              <input type="range" min={costRange.min} max={costRange.max} step={1}
                value={maxPrice ?? costRange.max}
                onChange={e => { const v = Number(e.target.value); setMaxPrice(v >= costRange.max ? null : v); }}
                className="budget-slider budget-slider-lg w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: '#fbbf24' }} />
              <div className={`flex justify-between mt-2 text-[11px] font-bold ${c.muted}`}>
                <span>${costRange.min}</span><span>${costRange.max}+</span>
              </div>
            </>
          )}

          <button onClick={() => show(null)}
            className="press mt-2.5 flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-yellow-400 text-[#0d1013] text-xs font-black uppercase tracking-wide">
            <Check size={14} /> Done
          </button>
        </div>
      )}
    </div>
  );
}

function Label({ c, children, inline }: { c: ReturnType<typeof cockpit>; children: React.ReactNode; inline?: boolean }) {
  return (
    <span className={`text-[10px] font-black uppercase tracking-widest ${c.muted} ${inline ? '' : 'mb-2 block'}`}>
      {children}
    </span>
  );
}
