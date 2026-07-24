import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import type { SpeedInterval } from '../../../providers/google/routing';

export type Map3DMode = 'ROADMAP' | 'SATELLITE' | 'HYBRID';

interface RouteOverlay {
  polyline: [number, number][];
  color: string;
  width?: number;
  dashed?: boolean;
  speedIntervals?: SpeedInterval[];
}

interface MarkerOverlay {
  lat: number;
  lng: number;
  color: string;
  label?: string;
  selected?: boolean;
}

interface Props {
  mode: Map3DMode;
  center: { lat: number; lng: number };
  zoom: number;
  routes?: RouteOverlay[];
  markers?: MarkerOverlay[];
  destination?: { lat: number; lng: number } | null;
}

const SPEED_COLORS: Record<string, string> = {
  NORMAL: '#22c55e',
  SLOW: '#f59e0b',
  TRAFFIC_JAM: '#dc2626',
};

let apiLoading: Promise<void> | null = null;

async function loadMapsApi(): Promise<void> {
  if (apiLoading) return apiLoading;
  apiLoading = (async () => {
    if ((window as any).google?.maps?.maps3d) return;

    const { data } = await axios.get('/api/google/maps-key');
    if (!data.key) throw new Error('No Google Maps key configured');

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) existing.remove();

    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&v=alpha&libraries=maps3d`;
      s.async = true;
      s.onload = () => {
        const poll = setInterval(() => {
          if ((window as any).google?.maps?.maps3d?.Map3DElement) {
            clearInterval(poll);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(poll); reject(new Error('Maps 3D timed out')); }, 15000);
      };
      s.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(s);
    });
  })();
  return apiLoading;
}

function zoomToRange(z: number) {
  return Math.max(200, 40000000 / Math.pow(2, z));
}

function getMaps3d() {
  return (window as any).google?.maps?.maps3d;
}

function makeDashes(polyline: [number, number][], color: string) {
  const segs: { coords: { lat: number; lng: number; altitude: number }[]; color: string }[] = [];
  let buf: { lat: number; lng: number; altitude: number }[] = [];
  let visible = true;

  for (let i = 0; i < polyline.length; i++) {
    buf.push({ lat: polyline[i][0], lng: polyline[i][1], altitude: 25 });
    if (buf.length >= 3 && i < polyline.length - 1) {
      if (visible) segs.push({ coords: [...buf], color });
      buf = [buf[buf.length - 1]];
      visible = !visible;
    }
  }
  if (buf.length >= 2 && visible) segs.push({ coords: buf, color });
  return segs;
}

function makeTrafficSegs(polyline: [number, number][], intervals: SpeedInterval[]) {
  const segs: { coords: { lat: number; lng: number; altitude: number }[]; color: string }[] = [];
  for (const iv of intervals) {
    const s = iv.startPolylinePointIndex ?? 0;
    const e = iv.endPolylinePointIndex ?? 0;
    if (e <= s || s >= polyline.length) continue;
    const pts = polyline.slice(s, Math.min(e + 1, polyline.length));
    if (pts.length < 2) continue;
    segs.push({
      coords: pts.map(([lat, lng]) => ({ lat, lng, altitude: 30 })),
      color: SPEED_COLORS[iv.speed] || SPEED_COLORS.NORMAL,
    });
  }
  return segs;
}

function appendPoly(map: any, maps3d: any, coords: any[], color: string, width: number, overlays: any[]) {
  const el = new maps3d.Polyline3DElement({
    path: coords, strokeColor: color, strokeWidth: width,
    altitudeMode: 'RELATIVE_TO_GROUND',
  });
  map.append(el);
  overlays.push(el);
}

function appendMarker(map: any, maps3d: any, lat: number, lng: number, html: string, overlays: any[]) {
  const mk = new maps3d.Marker3DElement({
    position: { lat, lng, altitude: 0 },
    altitudeMode: 'CLAMP_TO_GROUND',
    collisionBehavior: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY',
  });
  const tpl = document.createElement('template');
  tpl.setAttribute('slot', 'default');
  tpl.innerHTML = html;
  mk.append(tpl);
  map.append(mk);
  overlays.push(mk);
}

const DEST_PIN = `<div style="width:28px;height:28px;background:#dc2626;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 10px rgba(220,38,38,0.6);position:relative"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg)"><svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='white'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z'/><circle cx='12' cy='10' r='3' fill='#dc2626'/></svg></div></div>`;

function carparkPin(color: string, sel: boolean, label?: string) {
  const sz = sel ? 32 : 22;
  const bw = sel ? 4 : 2;
  const shadow = sel ? '0 3px 12px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.35)';
  const opacity = sel ? '1' : '0.85';
  const iconSz = Math.round(sz * 0.45);
  const pIcon = `<svg xmlns='http://www.w3.org/2000/svg' width='${iconSz}' height='${iconSz}' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><rect x='4' y='3' width='16' height='18' rx='2'/><path d='M9 17V7h4a3 3 0 0 1 0 6H9'/></svg>`;
  const pin = `<div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity}">
    <div style="width:${sz}px;height:${sz}px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:${bw}px solid white;box-shadow:${shadow};position:relative"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg)">${pIcon}</div></div>
    ${label && sel ? `<div style="margin-top:4px;background:rgba(0,0,0,0.75);color:white;font-size:10px;font-weight:800;font-family:system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${label}</div>` : ''}
  </div>`;
  return pin;
}

export function Google3DMap({ mode, center, zoom, routes, markers, destination }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMapsApi().then(() => setReady(true)).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const maps3d = getMaps3d();
    if (!maps3d?.Map3DElement) { setError('Maps 3D not available'); return; }

    mapRef.current?.remove();
    const map = new maps3d.Map3DElement({
      center: { lat: center.lat, lng: center.lng, altitude: 0 },
      range: zoomToRange(zoom), tilt: 55, heading: 0, mode,
      bounds: { south: 1.15, west: 103.59, north: 1.47, east: 104.12 },
    });
    map.style.width = '100%';
    map.style.height = '100%';
    containerRef.current.appendChild(map);
    mapRef.current = map;

    return () => { mapRef.current?.remove(); mapRef.current = null; overlaysRef.current = []; };
  }, [ready]);

  useEffect(() => { if (mapRef.current) mapRef.current.mode = mode; }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const endCamera = {
      center: { lat: center.lat, lng: center.lng, altitude: 0 },
      range: zoomToRange(zoom),
      tilt: 55,
      heading: 0,
    };

    if (typeof map.flyCameraTo === 'function') {
      try {
        map.flyCameraTo({ endCamera, durationMillis: 1200 });
        return;
      } catch { /* fall through to a direct set */ }
    }

    map.center = endCamera.center;
    map.range = endCamera.range;
  }, [center.lat, center.lng, zoom]);

  const clearOverlays = useCallback(() => {
    overlaysRef.current.forEach(el => { try { el.remove(); } catch {} });
    overlaysRef.current = [];
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const m3d = getMaps3d();
    if (!m3d) return;

    clearOverlays();
    const ov = overlaysRef.current;

    if (routes) {
      for (const r of routes) {
        if (r.polyline.length < 2) continue;
        try {
          if (r.speedIntervals?.length) {
            for (const seg of makeTrafficSegs(r.polyline, r.speedIntervals))
              appendPoly(map, m3d, seg.coords, seg.color, r.width ?? 8, ov);
          } else if (r.dashed) {
            for (const seg of makeDashes(r.polyline, r.color))
              appendPoly(map, m3d, seg.coords, seg.color, r.width ?? 5, ov);
          } else {
            const coords = r.polyline.map(([lat, lng]) => ({ lat, lng, altitude: 30 }));
            appendPoly(map, m3d, coords, r.color, r.width ?? 8, ov);
          }
        } catch {}
      }
    }

    if (destination && m3d.Marker3DElement) {
      try { appendMarker(map, m3d, destination.lat, destination.lng, DEST_PIN, ov); } catch {}
    }

    if (markers?.length && m3d.Marker3DElement) {
      for (const mk of markers) {
        try { appendMarker(map, m3d, mk.lat, mk.lng, carparkPin(mk.color, !!mk.selected, mk.label), ov); } catch {}
      }
    }
  }, [ready, routes, markers, destination, clearOverlays]);

  if (error) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/80">
        <p className="text-white text-sm font-bold">3D Maps unavailable: {error}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 z-10" />
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-md">
            <span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-yellow-400 animate-spin" />
            <span className="text-white text-[13px] font-bold">Loading 3D map…</span>
          </div>
        </div>
      )}
    </>
  );
}
