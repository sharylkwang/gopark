import { Plus, Minus, MapPin, Route } from 'lucide-react';
import { cockpit } from './Mobile/theme';

interface MapControlsProps {
  darkMode: boolean;
  className: string;
  offset?: number;
  dragging?: boolean;
  visible?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFocusPlace?: () => void;
  placeIsDest?: boolean;
  onFitRoute?: () => void;
}

export function MapControls({ darkMode, className, offset, dragging, visible = true, onZoomIn, onZoomOut, onFocusPlace, placeIsDest, onFitRoute }: MapControlsProps) {
  const c = cockpit(darkMode);
  const press = darkMode ? 'active:bg-white/10' : 'active:bg-black/5';
  const icon = darkMode ? 'text-white' : 'text-[#0d1013]';
  const card = `flex flex-col gap-1 p-1 rounded-2xl border shadow-xl backdrop-blur-lg ${c.raised} ${c.line} ${darkMode ? 'shadow-black/50' : 'shadow-black/15'}`;
  const btn = `h-9 w-9 grid place-items-center rounded-xl ${press} transition-colors`;
  const lifted = offset != null;

  return (
    <div
      style={lifted ? {
        transform: `translate3d(0, ${-offset}px, 0)`,
        transition: dragging
          ? 'opacity 0.2s linear'
          : 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s linear',
        willChange: 'transform',
      } : undefined}
      className={`absolute z-30 flex flex-col items-end gap-2 ${className} ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {(onFocusPlace || onFitRoute) && (
        <div className={card}>
          {onFocusPlace && (
            <button aria-label={placeIsDest ? 'Recenter on destination' : 'Recenter on start'} onClick={onFocusPlace} className={btn}>
              <MapPin size={16} strokeWidth={2.5} fill="currentColor" fillOpacity={0.2}
                className={placeIsDest ? 'text-[#dc2626]' : 'text-[#2563eb]'} />
            </button>
          )}
          {onFitRoute && (
            <button aria-label="Show full route" onClick={onFitRoute} className={btn}>
              <Route size={16} strokeWidth={2.5} className={icon} />
            </button>
          )}
        </div>
      )}
      <div className={card}>
        <button aria-label="Zoom in" onClick={onZoomIn} className={btn}>
          <Plus size={16} strokeWidth={2.75} className={icon} />
        </button>
        <button aria-label="Zoom out" onClick={onZoomOut} className={btn}>
          <Minus size={16} strokeWidth={2.75} className={icon} />
        </button>
      </div>
    </div>
  );
}
