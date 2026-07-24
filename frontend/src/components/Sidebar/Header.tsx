import { Zap, LogOut, X, Moon, Sun, Navigation } from 'lucide-react';

interface Props {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onLogout: () => void;
  onClose: () => void;
  onReset: () => void;
  locationShared: boolean;
  onShareLocation: () => void;
}

export function SidebarHeader({
  darkMode, toggleDarkMode, onLogout, onClose, onReset,
  locationShared, onShareLocation,
}: Props) {
  return (
    <div className="bg-neutral-900/90 md:rounded-t-2xl p-3 flex items-center gap-2 border-b-4 border-yellow-400 shrink-0">
      <h1 className="text-lg font-black italic text-white flex items-center uppercase cursor-pointer shrink-0" onClick={onReset}>
        GoPark <Zap className="bolt-idle text-yellow-400 fill-yellow-400 h-4 w-4 ml-1" />
      </h1>
      {!locationShared && (
        <button onClick={onShareLocation}
          className="bg-gray-800 p-2 rounded transition hover:bg-gray-700 gps-blink">
          <Navigation size={14} className="text-red-400" />
        </button>
      )}
      <div className="flex-1" />
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
