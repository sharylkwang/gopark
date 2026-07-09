import { useState, useRef, useMemo, useEffect } from 'react';
import { Layers, Globe } from 'lucide-react';
import { TILE_PROVIDERS, getPreviewUrl } from '../../providers/tiles';
import type { TileProviderConfig } from '../../types/map';
import type { Map3DMode } from './layers/Google3DMap';

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
  mapCenter?: { lat: number; lng: number };
  mapZoom?: number;
  darkMode?: boolean;
  sidebarOpen?: boolean;
}

function TileCard({ tile, active, disabled, onClick, lat, lng, zoom, darkMode }: {
  tile: TileProviderConfig; active: boolean; disabled: boolean; onClick: () => void;
  lat: number; lng: number; zoom: number; darkMode?: boolean;
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
        active ? 'border-red-500 ring-2 ring-red-200' : darkMode ? 'border-neutral-600 hover:border-neutral-400' : 'border-gray-200 hover:border-gray-400'
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
        active ? 'font-black text-red-500' : darkMode ? 'font-semibold text-gray-400' : 'font-semibold text-gray-500'
      }`}>{tile.name}</span>
    </button>
  );
}

const MAP_3D_MODES: { id: Map3DMode; label: string; preview: string }[] = [
  { id: 'ROADMAP', label: 'Roadmap', preview: '#c8d8e8' },
  { id: 'HYBRID', label: 'Hybrid', preview: '#1a3a2a' },
];

export function TileLayerSwitcher({ currentTile, onTileChange, mode3D, onMode3DChange, mapCenter, mapZoom, darkMode, sidebarOpen }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const gpuOk = useMemo(() => hasGpu(), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const lat = mapCenter?.lat ?? 1.2834;
  const lng = mapCenter?.lng ?? 103.8607;
  const zoom = Math.min(mapZoom ?? 15, 15);

  const selectTile = (id: string) => {
    onMode3DChange(null);
    onTileChange(id);
    setOpen(false);
  };

  const select3D = (m: Map3DMode) => {
    onMode3DChange(mode3D === m ? null : m);
    setOpen(false);
  };

  return (
    <div ref={panelRef} className={`absolute bottom-3 z-[15] max-md:bottom-20 max-md:left-auto max-md:right-2.5 ${sidebarOpen ? 'left-[356px]' : 'left-3'}`}>
      {open ? (
        <div className={`backdrop-blur-xl rounded-2xl shadow-xl border p-3 w-[260px] ${darkMode ? 'bg-neutral-800/90 border-neutral-600/50' : 'bg-white/80 border-gray-200/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Layers</span>
            <button onClick={() => setOpen(false)} className={`text-sm font-bold ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>✕</button>
          </div>

          <div className="mb-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Map Type</span>
            <div className="grid grid-cols-4 gap-1.5">
              {TILE_PROVIDERS.map((tile) => (
                <TileCard key={tile.id} tile={tile}
                  active={!mode3D && currentTile === tile.id}
                  disabled={!tile.url}
                  onClick={() => tile.url && selectTile(tile.id)}
                  lat={lat} lng={lng} zoom={zoom} darkMode={darkMode} />
              ))}
            </div>
          </div>

          {gpuOk ? (
            <div className={`border-t pt-2 ${darkMode ? 'border-neutral-600/40' : 'border-gray-200/40'}`}>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">3D Maps</span>
              <div className="grid grid-cols-4 gap-1.5">
                {MAP_3D_MODES.map((m) => (
                  <button key={m.id} onClick={() => select3D(m.id)}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      mode3D === m.id ? 'scale-105' : 'opacity-70 hover:opacity-100'
                    }`}>
                    <div className={`relative w-12 h-12 rounded-xl border-2 shadow-sm transition-all overflow-hidden flex items-center justify-center ${
                      mode3D === m.id ? 'border-red-500 ring-2 ring-red-200' : darkMode ? 'border-neutral-600 hover:border-neutral-400' : 'border-gray-200 hover:border-gray-400'
                    }`} style={{ background: `linear-gradient(135deg, ${m.preview}, ${m.preview}dd)` }}>
                      <Globe size={16} className="text-white/80" />
                    </div>
                    <span className={`text-[9px] leading-tight text-center max-w-14 ${
                      mode3D === m.id ? 'font-black text-red-500' : darkMode ? 'font-semibold text-gray-400' : 'font-semibold text-gray-500'
                    }`}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={`border-t pt-2 ${darkMode ? 'border-neutral-600/40' : 'border-gray-200/40'}`}>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block">3D Maps</span>
              <p className="text-[9px] text-gray-400">Requires a dedicated GPU</p>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className={`backdrop-blur-lg shadow-lg border rounded-xl p-2 transition flex items-center gap-1.5 ${darkMode ? 'bg-neutral-800/80 border-neutral-600/50 hover:bg-neutral-800' : 'bg-white/70 border-gray-200/50 hover:bg-white/90'}`}>
          <Layers size={14} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
          <span className={`text-[10px] font-bold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Layers</span>
        </button>
      )}
    </div>
  );
}
