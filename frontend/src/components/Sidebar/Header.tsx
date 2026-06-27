<<<<<<< HEAD
import { Zap, Navigation, LogOut, X, Moon, Sun } from 'lucide-react';
=======
import { Zap, LogOut, X, Moon, Sun, Navigation } from 'lucide-react';
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1

interface Props {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  onClose: () => void;
  onReset: () => void;
<<<<<<< HEAD
  weather: string;
  WeatherIcon: React.ComponentType<{ size: number; className?: string }>;
  locationShared: boolean;
  showTooltip: boolean;
  setShowTooltip: (v: boolean) => void;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
=======
  locationShared: boolean;
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
  onShareLocation: () => void;
}

export function SidebarHeader({
  darkMode, toggleDarkMode, onLogout, onClose, onReset,
<<<<<<< HEAD
  weather, WeatherIcon, locationShared,
  showTooltip, setShowTooltip, tooltipRef, onShareLocation,
}: Props) {
  return (
    <div className="bg-neutral-900 p-3 flex items-center gap-2 border-b-4 border-yellow-400 shrink-0">
      <h1 className="text-lg font-black italic text-white flex items-center uppercase cursor-pointer shrink-0" onClick={onReset}>
        GoPark <Zap className="text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
      </h1>
      <div className="relative flex items-center min-w-0 flex-1" ref={tooltipRef}>
        <button onClick={() => { if (!locationShared) setShowTooltip(!showTooltip); }}
          className={`text-[10px] font-black px-2 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 transition cursor-pointer max-w-full ${locationShared ? 'bg-green-600/20 text-green-400 border border-green-600/40' : 'bg-gray-800 text-yellow-400 border border-gray-700 hover:border-yellow-400/50'}`}>
          <WeatherIcon size={14} className="shrink-0" /><span className="truncate">{weather}</span>
        </button>
        {showTooltip && (
          <div className="animate-pop-in absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-64 z-50">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45" />
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0 mt-0.5">
                <span className="absolute inset-0 rounded-full bg-red-400 location-ping" />
                <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white">
                  <Navigation size={15} className="fill-white" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-gray-800 leading-tight">Use your location?</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Weather and carparks for exactly where you are.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={onShareLocation} className="flex-1 bg-gradient-to-r from-red-600 to-rose-500 text-white text-[11px] font-black uppercase tracking-wide py-2 rounded-xl shadow-sm hover:shadow-md hover:brightness-110 active:scale-95 transition">Allow</button>
              <button onClick={() => setShowTooltip(false)} className="px-3 bg-gray-100 text-gray-500 text-[11px] font-black uppercase tracking-wide py-2 rounded-xl hover:bg-gray-200 active:scale-95 transition">Not now</button>
            </div>
          </div>
        )}
      </div>
=======
  locationShared, onShareLocation,
}: Props) {
  return (
    <div className="bg-neutral-900/90 md:rounded-t-2xl p-3 flex items-center gap-2 border-b-4 border-yellow-400 shrink-0">
      <h1 className="text-lg font-black italic text-white flex items-center uppercase cursor-pointer shrink-0" onClick={onReset}>
        GoPark <Zap className="text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
      </h1>
      {!locationShared && (
        <button onClick={onShareLocation}
          className="bg-gray-800 p-2 rounded transition hover:bg-gray-700 gps-blink">
          <Navigation size={14} className="text-red-400" />
        </button>
      )}
      <div className="flex-1" />
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={toggleDarkMode} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button onClick={onLogout} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"><LogOut size={16} /></button>
        <button onClick={onClose} className="bg-gray-800 p-2 rounded text-gray-400 hover:text-white transition"><X size={16} /></button>
      </div>
    </div>
  );
}
