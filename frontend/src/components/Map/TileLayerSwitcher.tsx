import { useState, useRef, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { TILE_PROVIDERS, getPreviewUrl } from '../../config/tiles';
import type { TileProviderConfig } from '../../types/map';

interface Props {
  currentTile: string;
  onTileChange: (id: string) => void;
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
          />
        )}
        {tile.is3D && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-black text-white bg-black/50 px-1.5 py-0.5 rounded">
              3D
            </span>
          </div>
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

export function TileLayerSwitcher({ currentTile, onTileChange }: Props) {
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
    <div ref={panelRef} className="absolute bottom-6 left-3 z-[1000]">
      {open ? (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[340px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Map Style</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {TILE_PROVIDERS.map((tile) => {
              const disabled = !tile.url;
              return (
                <TileCard
                  key={tile.id}
                  tile={tile}
                  active={currentTile === tile.id}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) onTileChange(tile.id);
                  }}
                />
              );
            })}
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
