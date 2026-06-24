import { useState, useRef, useEffect } from 'react';
import { Layers, Globe } from 'lucide-react';
import { TILE_PROVIDERS, getPreviewUrl } from '../../providers/tiles';
import type { TileProviderConfig } from '../../types/map';
import type { Map3DMode } from './layers/Google3DMap';

interface Props {
  currentTile: string;
  onTileChange: (id: string) => void;
  mode3D: Map3DMode | null;
  onMode3DChange: (mode: Map3DMode | null) => void;
  sidebarOpen?: boolean;
}

function TileCard({ tile, active, disabled, onClick }: { tile: TileProviderConfig; active: boolean; disabled: boolean; onClick: () => void }) {
  const previewUrl = getPreviewUrl(tile);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : active ? 'scale-105' : 'opacity-70 hover:opacity-100'
      }`}
    >
      <div
        className={`relative w-14 h-14 rounded-lg border-2 shadow-sm transition-all overflow-hidden ${
          active ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-gray-400'
        }`}
        style={{ backgroundColor: tile.preview || '#ccc' }}
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt={tile.name}
            className="w-full h-full object-cover"
            draggable={false}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
      </div>
      <span className={`text-[10px] leading-tight text-center max-w-16 ${
        active ? 'font-black text-red-600' : 'font-semibold text-gray-500'
      }`}>
        {tile.name}
      </span>
    </button>
  );
}

const MAP_3D_MODES: { id: Map3DMode; label: string; preview: string }[] = [
  { id: 'ROADMAP', label: 'Roadmap', preview: '#c8d8e8' },
  { id: 'HYBRID', label: 'Hybrid', preview: '#1a3a2a' },
];

export function TileLayerSwitcher({ currentTile, onTileChange, mode3D, onMode3DChange, sidebarOpen = true }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-6 left-3 z-[1000]"
    >
      {open ? (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Layers</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
              ✕
            </button>
          </div>

          <div className="mb-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Map Type</span>
            <div className="grid grid-cols-4 gap-2">
              {TILE_PROVIDERS.map((tile) => {
                const disabled = !tile.url;
                return (
                  <TileCard
                    key={tile.id}
                    tile={tile}
                    active={!mode3D && currentTile === tile.id}
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) {
                        onMode3DChange(null);
                        onTileChange(tile.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">3D Maps</span>
            <div className="grid grid-cols-4 gap-2">
              {MAP_3D_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onMode3DChange(mode3D === m.id ? null : m.id)}
                  className={`flex flex-col items-center gap-1 transition-all ${
                    mode3D === m.id ? 'scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`relative w-14 h-14 rounded-lg border-2 shadow-sm transition-all overflow-hidden flex items-center justify-center ${
                      mode3D === m.id ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${m.preview}, ${m.preview}dd)` }}
                  >
                    <Globe size={20} className="text-white/80" />
                  </div>
                  <span className={`text-[10px] leading-tight text-center max-w-16 ${
                    mode3D === m.id ? 'font-black text-red-600' : 'font-semibold text-gray-500'
                  }`}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-white shadow-lg border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition flex items-center gap-2"
        >
          <Layers size={16} className="text-gray-600" />
          <span className="text-xs font-bold text-gray-600">Layers</span>
        </button>
      )}
    </div>
  );
}
