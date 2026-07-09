import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { totals } from '../../utils/format';
import type { CarparkSummary } from '../../types';

const AVAILABILITY = {
  plenty: '#16a34a',
  filling: '#f59e0b',
  scarce: '#ef4444',
  full: '#991b1b',
  unknown: '#64748b',
};

function availabilityColor(cp: CarparkSummary, vehicleType: string) {
  const forVehicle = cp.availability[vehicleType];
  const t = forVehicle
    ? { available: forVehicle.available ?? 0, total: forVehicle.total ?? 0 }
    : totals(cp.availability);

  if (t.total <= 0) return AVAILABILITY.unknown;
  if (t.available <= 0) return AVAILABILITY.full;

  const pct = (t.available / t.total) * 100;
  if (pct > 30) return AVAILABILITY.plenty;
  if (pct > 10) return AVAILABILITY.filling;
  return AVAILABILITY.scarce;
}

const INK = '#0d1013';
const BRAND = '#facc15';

function badge({ body, glyph, ring, size, selected = false, faded = false, dashed = false, bob = false }: {
  body: string; glyph: string; ring: string; size: number;
  selected?: boolean; faded?: boolean; dashed?: boolean; bob?: boolean;
}) {
  const hit = size + 14;
  const stem = Math.round(size * 0.34);
  const outline = selected ? 3 : 2.5;

  const shadow = selected
    ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))'
    : 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))';

  const wrap = [
    `width:${hit}px`,
    `height:${hit}px`,
    `display:flex`,
    `flex-direction:column`,
    `align-items:center`,
    `justify-content:center`,
    `cursor:pointer`,
    `filter:${shadow}`,
    `opacity:${faded ? 0.75 : 1}`,
  ].join(';');

  const box = [
    `width:${size}px`,
    `height:${size}px`,
    `background:${body}`,
    `border-radius:${Math.round(size * 0.3)}px`,
    `border:${outline}px ${dashed ? 'dashed' : 'solid'} ${ring}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `color:${glyph}`,
    `font-weight:900`,
    `font-size:${Math.round(size * 0.55)}px`,
    `line-height:1`,
    `font-family:Inter,system-ui,sans-serif`,
    `pointer-events:none`,
  ].join(';');

  const tip = [
    `width:${stem}px`,
    `height:${stem}px`,
    `margin-top:-${Math.round(stem * 0.6)}px`,
    `background:${body}`,
    `border-right:${outline}px solid ${ring}`,
    `border-bottom:${outline}px solid ${ring}`,
    `border-bottom-right-radius:3px`,
    `transform:rotate(45deg)`,
    `pointer-events:none`,
  ].join(';');

  return L.divIcon({
    className: '',
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit],
    popupAnchor: [0, -hit],
    html: `<div class="${bob ? 'gp-bob' : ''}" style="${wrap}"><div style="${box}">P</div><div style="${tip}"></div></div>`,
  });
}

function pin(color: string, size: number, selected: boolean, dimOthers: boolean, _darkBasemap: boolean, bob = false) {
  return selected
    ? badge({ body: color, glyph: '#ffffff', ring: BRAND, size: size + 4, selected: true, bob })
    : badge({ body: color, glyph: '#ffffff', ring: '#ffffff', size, faded: dimOthers, bob });
}

function bgPin(size: number, darkBasemap: boolean) {
  return darkBasemap
    ? badge({ body: 'rgba(30,41,59,0.9)', glyph: '#cbd5e1', ring: '#64748b', size: size - 2, faded: true })
    : badge({ body: '#ffffff', glyph: '#64748b', ring: '#94a3b8', size: size - 2, faded: true });
}

function clusterIcon(count: number, zoom: number, darkBasemap: boolean) {
  const base = zoom < 13 ? 52 : zoom < 15 ? 46 : zoom < 17 ? 40 : 36;
  const scale = Math.min(1 + Math.log10(count) * 0.15, 1.4);
  const size = Math.round(base * scale);
  const fontSize = size < 40 ? 11 : 13;

  const ring = count > 100 ? '#facc15' : count > 30 ? '#fbbf24' : '#fde047';

  const label = count >= 1000
    ? `${(count / 1000).toFixed(1)}k`
    : String(count);

  const style = [
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `width:${size}px`,
    `height:${size}px`,
    `border-radius:50%`,
    `background:${darkBasemap ? BRAND : INK}`,
    `color:${darkBasemap ? INK : '#ffffff'}`,
    `font-weight:900`,
    `font-size:${fontSize}px`,
    `border:3px solid ${ring}`,
    `box-shadow:0 2px 8px rgba(0,0,0,0.45), 0 0 0 1.5px rgba(255,255,255,0.85)`,
    `cursor:pointer`,
  ].join(';');

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<div style="${style}">${label}</div>`,
  });
}

function bgClusterIcon(count: number, zoom: number, darkBasemap: boolean) {
  const base = zoom < 13 ? 40 : zoom < 15 ? 36 : zoom < 17 ? 32 : 28;
  const scale = Math.min(1 + Math.log10(count) * 0.12, 1.3);
  const size = Math.round(base * scale);
  const fontSize = size < 32 ? 10 : 11;

  const label = count >= 1000
    ? `${(count / 1000).toFixed(1)}k`
    : String(count);

  const style = [
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `width:${size}px`,
    `height:${size}px`,
    `border-radius:50%`,
    `background:${darkBasemap ? 'rgba(30,41,59,0.92)' : 'rgba(255,255,255,0.92)'}`,
    `color:${darkBasemap ? '#cbd5e1' : '#475569'}`,
    `font-weight:800`,
    `font-size:${fontSize}px`,
    `border:2px solid #94a3b8`,
    `box-shadow:0 1px 4px rgba(0,0,0,0.3)`,
    `cursor:pointer`,
  ].join(';');

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<div style="${style}">${label}</div>`,
  });
}

interface Props {
  carparks: CarparkSummary[];
  backgroundCarparks?: CarparkSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasSearched?: boolean;
}

export function MarkerCluster({ carparks, backgroundCarparks, selectedId, onSelect, hasSearched }: Props) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const bgClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const carparksRef = useRef(carparks);

  onSelectRef.current = onSelect;
  carparksRef.current = carparks;

  const carparkKey = carparks.map(c => c.id).join(',');
  const primaryIds = new Set(carparks.map(c => c.id));

  const bgCarparks = (backgroundCarparks ?? []).filter(c => !primaryIds.has(c.id));
  const bgKey = bgCarparks.length + '-' + (bgCarparks[0]?.id ?? '');

  useEffect(() => {
    if (bgClusterRef.current) {
      map.removeLayer(bgClusterRef.current);
      bgClusterRef.current = null;
    }

    if (!bgCarparks.length) return;

    const bgCluster = L.markerClusterGroup({
      maxClusterRadius: (zoom: number) => {
        if (zoom <= 12) return 120;
        if (zoom <= 14) return 80;
        if (zoom <= 16) return 50;
        return 30;
      },
      disableClusteringAtZoom: 19,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      animate: false,
      animateAddingMarkers: false,
      iconCreateFunction: (c) => bgClusterIcon(c.getChildCount(), map.getZoom()),
    });

    const icon = bgPin(28);
    for (const cp of bgCarparks) {
      const marker = L.marker([cp.lat, cp.lng], { icon, zIndexOffset: -100 });
      marker.on('click', () => onSelectRef.current(cp.id));
      bgCluster.addLayer(marker);
    }

    map.addLayer(bgCluster);
    bgClusterRef.current = bgCluster;

    return () => {
      if (bgClusterRef.current) {
        map.removeLayer(bgClusterRef.current);
        bgClusterRef.current = null;
      }
    };
  }, [bgKey]);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }
    markersRef.current.clear();

    const cps = carparksRef.current;
    const distances = cps.map(c => c.distance ?? 0);
    const maxDist = hasSearched ? Math.max(...distances, 1) : 0;

    const cluster = L.markerClusterGroup({
      maxClusterRadius: hasSearched
        ? 0
        : (zoom: number) => {
            if (zoom <= 12) return 120;
            if (zoom <= 14) return 80;
            if (zoom <= 16) return 50;
            return 30;
          },
      disableClusteringAtZoom: hasSearched ? 0 : 19,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      animate: false,
      animateAddingMarkers: false,
      iconCreateFunction: (c) => clusterIcon(c.getChildCount(), map.getZoom()),
    });

    for (const cp of cps) {
      const color = hasSearched
        ? distanceColor(cp, maxDist)
        : '#3b82f6';

      const marker = L.marker([cp.lat, cp.lng], {
        icon: pin(color, 26, false, false),
      });

      marker.on('click', () => onSelectRef.current(cp.id));
      markersRef.current.set(cp.id, marker);
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
    };
  }, [carparkKey, hasSearched]);

  useEffect(() => {
    const cps = carparksRef.current;
    const distances = cps.map(c => c.distance ?? 0);
    const maxDist = hasSearched ? Math.max(...distances, 1) : 0;

    for (const cp of cps) {
      const marker = markersRef.current.get(cp.id);
      if (!marker) continue;

      const isSelected = cp.id === selectedId;
      const dimOthers = !!hasSearched && selectedId !== null;

      let color = '#3b82f6';
      if (isSelected) {
        color = '#2563eb';
      } else if (hasSearched) {
        color = distanceColor(cp, maxDist);
      }

      const size = isSelected ? 34 : 26;
      marker.setIcon(pin(color, size, isSelected, dimOthers));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    }
  }, [selectedId, carparkKey, hasSearched]);

  return null;
}
