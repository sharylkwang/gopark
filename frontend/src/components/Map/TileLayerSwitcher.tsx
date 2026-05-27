import { useState, useRef, useEffect } from 'react';
import { Layers, Building2, Globe } from 'lucide-react';
import { TILE_PROVIDERS, getPreviewUrl } from '../../providers/tiles';
import type { TileProviderConfig } from '../../types/map';

interface Props {
  currentTile: string;
  onTileChange: (id: string) => void;
  buildings3D: boolean;
  onToggleBuildings: () => void;
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

function FeatureToggle({ label, icon: Icon, active, onClick }: { label: string; icon: typeof Building2; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-xs font-bold ${
        active
          ? 'border-red-500 bg-red-50 text-red-700'
          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-400'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

const baseMaps = TILE_PROVIDERS.filter((t) => !t.is3D && t.id !== 'google-hybrid');
const featureMaps = TILE_PROVIDERS.filter((t) => t.is3D || t.id === 'google-hybrid');

export function TileLayerSwitcher({ currentTile, onTileChange, buildings3D, onToggleBuildings, sidebarOpen = true }: Props) {
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
      className="absolute bottom-6 z-[1000] transition-all duration-300"
      style={{ left: sidebarOpen ? 'max(calc(min(85vw, 420px) + 12px), 12px)' : '12px' }}
    >
      {open ? (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[340px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Layers</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
              ✕
            </button>
          </div>

          <div className="mb-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Map Provider</span>
            <div className="grid grid-cols-5 gap-2">
              {baseMaps.map((tile) => {
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

          <div className="border-t border-gray-100 pt-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Features</span>
            <div className="flex flex-wrap gap-2">
              <FeatureToggle
                label="3D Buildings"
                icon={Building2}
                active={buildings3D}
                onClick={onToggleBuildings}
              />
              {featureMaps.map((tile) => {
                const disabled = !tile.url;
                return (
                  <FeatureToggle
                    key={tile.id}
                    label={tile.name}
                    icon={Globe}
                    active={currentTile === tile.id}
                    onClick={() => {
                      if (!disabled) onTileChange(tile.id);
                    }}
                  />
                );
              })}
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
