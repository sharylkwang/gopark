import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Globe, Building2, ZoomIn, AlertTriangle, RotateCw, Check } from 'lucide-react';
import { TILE_PROVIDERS, getPreviewUrl } from '../../providers/tiles';
import type { TileProviderConfig } from '../../types/map';
import type { Map3DMode } from './layers/Google3DMap';
import type { LayoutMode } from '../../hooks/useLayoutMode';
import type { BuildingStatus } from './layers/OSMBuildingLayer';

const BUILDINGS_MIN_ZOOM = 16;

function hasGpu(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!ext) return true;
    const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase();
    const sw = ['swiftshader', 'llvmpipe', 'softpipe', 'microsoft basic'];
    return !sw.some(s => renderer.includes(s));
  } catch { return false; }
}

interface Props {
  currentTile: string;
  onTileChange: (id: string) => void;
  mode3D: Map3DMode | null;
  onMode3DChange: (mode: Map3DMode | null) => void;
  buildings3D: boolean;
  onBuildings3DChange: (on: boolean) => void;
  buildingStatus: BuildingStatus;
  onRetryBuildings: () => void;
  mapZoomLive?: number;
  mapCenter?: { lat: number; lng: number };
  mapZoom?: number;
  layout?: LayoutMode;
  darkMode?: boolean;
}

const SWITCHER_POSITION: Record<LayoutMode, string> = {
  desktop: 'bottom-3 left-[356px]',
  sheet: 'left-3 bottom-0 translate-y-[calc(-1*(var(--sheet-visible,7rem)+0.75rem))] will-change-transform',
  rail: 'bottom-3 right-16',
};

function TileCard({ tile, active, disabled, onClick, lat, lng, zoom, darkMode }: {
  tile: TileProviderConfig; active: boolean; disabled: boolean; onClick: () => void;
  lat: number; lng: number; zoom: number; darkMode: boolean;
}) {
  const previewUrl = getPreviewUrl(tile, lat, lng, Math.min(zoom, tile.maxZoom));
  const [loaded, setLoaded] = useState(false);
  const prevUrl = useRef(previewUrl);
  useEffect(() => {
    if (prevUrl.current !== previewUrl) { setLoaded(false); prevUrl.current = previewUrl; }
  }, [previewUrl]);

  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1 transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : active ? 'scale-105' : 'opacity-70 hover:opacity-100'
      }`}>
      <div className={`relative w-12 h-12 rounded-xl border-2 shadow-sm transition-all overflow-hidden ${
        active
          ? 'border-yellow-400 ring-2 ring-yellow-400/30'
          : darkMode ? 'border-white/15 hover:border-white/40' : 'border-gray-200 hover:border-gray-400'
      }`} style={{ backgroundColor: tile.preview || '#ccc' }}>
        {previewUrl && (
          <img src={previewUrl} alt={tile.name}
            className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            draggable={false} loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </div>
      <span className={`text-[9px] leading-tight text-center max-w-14 ${
        active
          ? 'font-black text-yellow-500'
          : darkMode ? 'font-semibold text-[#8b95a3]' : 'font-semibold text-gray-500'
      }`}>{tile.name}</span>
    </button>
  );
}

const MAP_3D_MODES: { id: Map3DMode; label: string; preview: string }[] = [
  { id: 'ROADMAP', label: 'Roadmap', preview: '#c8d8e8' },
  { id: 'HYBRID', label: 'Satellite', preview: '#1a3a2a' },
];

export function TileLayerSwitcher({ currentTile, onTileChange, mode3D, onMode3DChange, buildings3D, onBuildings3DChange, buildingStatus, onRetryBuildings, mapZoomLive, mapCenter, mapZoom, layout = 'desktop', darkMode = false }: Props) {
  const belowMinZoom = (mapZoomLive ?? 20) < BUILDINGS_MIN_ZOOM;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const gpuOk = useMemo(() => hasGpu(), []);

  const surface = darkMode
    ? 'bg-[#161b21]/90 border-white/10'
    : 'bg-white/80 border-gray-200/50';
  const heading = darkMode ? 'text-[#8b95a3]' : 'text-gray-500';
  const subtle = darkMode ? 'text-[#8b95a3]' : 'text-gray-400';
  const divider = darkMode ? 'border-white/10' : 'border-gray-200/40';

  const lat = mapCenter?.lat ?? 1.2834;
  const lng = mapCenter?.lng ?? 103.8607;
  const zoom = Math.min(mapZoom ?? 15, 15);
  const themedTiles = TILE_PROVIDERS.filter(
    (t) => !t.theme || t.theme === 'any' || t.theme === (darkMode ? 'dark' : 'light'),
  );

  const selectTile = (id: string) => {
    onMode3DChange(null);
    onTileChange(id);
    setOpen(false);
  };

  const select3D = (m: Map3DMode) => {
    if (mode3D !== m) onBuildings3DChange(false);
    onMode3DChange(mode3D === m ? null : m);
    setOpen(false);
  };

  const isCompact = layout !== 'desktop';

  const panel = (
        <div className={`backdrop-blur-xl rounded-2xl shadow-xl border p-3 ${surface} ${
          isCompact
            ? 'animate-drop-in w-full max-h-[70vh] overflow-y-auto overscroll-contain sidebar-scroll'
            : 'w-[260px] max-w-[calc(100vw-24px)]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${heading}`}>Layers</span>
            <button onClick={() => setOpen(false)} aria-label="Close layers"
              className={`h-8 w-8 -m-1.5 grid place-items-center rounded-lg text-sm font-bold ${subtle}`}>✕</button>
          </div>

          <div className="mb-2">
            <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 block ${subtle}`}>Map Type</span>
            <div className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${Math.min(themedTiles.length, 4)}, minmax(0, 1fr))` }}>
              {themedTiles.map((tile) => (
                <TileCard key={tile.id} tile={tile}
                  active={!mode3D && currentTile === tile.id}
                  disabled={!tile.url}
                  onClick={() => tile.url && selectTile(tile.id)}
                  lat={lat} lng={lng} zoom={zoom} darkMode={darkMode} />
              ))}
            </div>
          </div>

          <div className={`border-t pt-2 mb-2 ${divider}`}>
            <div className={`rounded-xl border p-2.5 transition-colors ${
              buildings3D
                ? 'border-yellow-400/50 bg-yellow-400/8'
                : darkMode ? 'border-white/10 bg-white/4' : 'border-gray-200 bg-gray-50'
            }`}>
              <button onClick={() => { onMode3DChange(null); onBuildings3DChange(!buildings3D); }}
                className="flex items-center gap-2.5 w-full">
                <span className={`shrink-0 h-8 w-8 grid place-items-center rounded-lg ${
                  buildings3D ? 'bg-yellow-400 text-[#0d1013]' : darkMode ? 'bg-white/8 text-[#8b95a3]' : 'bg-white text-gray-500'
                }`}>
                  <Building2 size={15} />
                </span>

                <span className="flex-1 min-w-0 text-left">
                  <span className={`block text-[12px] font-bold ${heading}`}>3D Buildings</span>
                  <span className={`block text-[9px] ${subtle}`}>OpenStreetMap footprints</span>
                </span>

                <span className={`shrink-0 relative h-5 w-9 rounded-full transition-colors ${
                  buildings3D ? 'bg-yellow-400' : darkMode ? 'bg-white/15' : 'bg-gray-300'
                }`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${buildings3D ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>

              {buildings3D && (
                <div className={`animate-fade-up mt-2 pt-2 border-t ${divider}`}>
                  {belowMinZoom ? (
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-500">
                      <ZoomIn size={12} /> Zooming in to level {BUILDINGS_MIN_ZOOM}…
                    </p>
                  ) : buildingStatus.state === 'loading' ? (
                    <p className={`flex items-center gap-1.5 text-[10px] font-semibold ${subtle}`}>
                      <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Loading buildings…
                    </p>
                  ) : buildingStatus.state === 'error' ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-red-500">
                        <AlertTriangle size={12} /> OpenStreetMap didn't respond
                      </p>
                      <button onClick={onRetryBuildings}
                        className="press shrink-0 flex items-center gap-1 h-6 px-2 rounded-md bg-yellow-400 text-[#0d1013] text-[10px] font-black">
                        <RotateCw size={11} /> Retry
                      </button>
                    </div>
                  ) : (
                    <p className={`flex items-center gap-1.5 text-[10px] font-semibold ${subtle}`}>
                      <Check size={12} className="text-[#22c55e]" />
                      {buildingStatus.count.toLocaleString()} buildings in view
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {gpuOk ? (
            <div className={`border-t pt-2 ${divider}`}>
              <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 block ${subtle}`}>3D Maps</span>
              <div className="grid grid-cols-4 gap-1.5">
                {MAP_3D_MODES.map((m) => (
                  <button key={m.id} onClick={() => select3D(m.id)}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      mode3D === m.id ? 'scale-105' : 'opacity-70 hover:opacity-100'
                    }`}>
                    <div className={`relative w-12 h-12 rounded-xl border-2 shadow-sm transition-all overflow-hidden flex items-center justify-center ${
                      mode3D === m.id ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-gray-400'
                    }`} style={{ background: `linear-gradient(135deg, ${m.preview}, ${m.preview}dd)` }}>
                      <Globe size={16} className="text-white/80" />
                    </div>
                    <span className={`text-[9px] leading-tight text-center max-w-14 ${
                      mode3D === m.id ? 'font-black text-red-600' : 'font-semibold text-gray-500'
                    }`}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200/40 pt-2">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">3D Maps</span>
              <p className="text-[9px] text-gray-400">Requires a dedicated GPU</p>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="bg-white/70 backdrop-blur-lg shadow-lg border border-gray-200/50 rounded-xl p-2 hover:bg-white/90 transition flex items-center gap-1.5">
          <Layers size={14} className="text-gray-600" />
          <span className="text-[10px] font-bold text-gray-600">Layers</span>
        </button>
      )}
    </div>
  );
}
