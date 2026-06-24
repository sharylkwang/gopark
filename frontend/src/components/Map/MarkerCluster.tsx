import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { CarparkSummary } from '../../types';

function distanceColor(cp: CarparkSummary, maxDist: number) {
  if (cp.distance == null || !maxDist) return '#15803d';

  const ratio = Math.min(cp.distance / maxDist, 1);
  const r = Math.round(5 + ratio * (200 - 5));
  const g = Math.round(80 + ratio * (240 - 80));
  const b = Math.round(20 + ratio * (210 - 20));

  return `rgb(${r},${g},${b})`;
}

function pin(color: string, size: number, selected: boolean, dimOthers: boolean) {
  const opacity = selected ? '1' : dimOthers ? '0.65' : '1';
  const border = selected
    ? '3px solid white'
    : '2px solid rgba(255,255,255,0.6)';
  const hit = size + 12;

  const inner = [
    `width:${size}px`,
    `height:${size}px`,
    `background:${color}`,
    `border-radius:50% 50% 50% 0`,
    `transform:rotate(-45deg)`,
    `border:${border}`,
    `opacity:${opacity}`,
    `pointer-events:none`,
  ].join(';');

  const outer = [
    `width:${hit}px`,
    `height:${hit}px`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `cursor:pointer`,
  ].join(';');

  return L.divIcon({
    className: '',
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit],
    popupAnchor: [0, -hit],
    html: `<div style="${outer}"><div style="${inner}"></div></div>`,
  });
}

function clusterIcon(count: number, zoom: number) {
  const base = zoom < 13 ? 52 : zoom < 15 ? 46 : zoom < 17 ? 40 : 36;
  const scale = Math.min(1 + Math.log10(count) * 0.15, 1.4);
  const size = Math.round(base * scale);
  const fontSize = size < 40 ? 11 : 13;

  let bg = '#4ade80';
  if (count > 100) bg = '#15803d';
  else if (count > 30) bg = '#16a34a';
  else if (count > 10) bg = '#22c55e';

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
    `background:${bg}`,
    `color:white`,
    `font-weight:900`,
    `font-size:${fontSize}px`,
    `border:3px solid white`,
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
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasSearched?: boolean;
}

export function MarkerCluster({ carparks, selectedId, onSelect, hasSearched }: Props) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const carparksRef = useRef(carparks);

  onSelectRef.current = onSelect;
  carparksRef.current = carparks;

  const carparkKey = carparks.map(c => c.id).join(',');

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
        icon: pin(color, 20, false, false),
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

      const size = isSelected ? 34 : 20;
      marker.setIcon(pin(color, size, isSelected, dimOthers));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    }
  }, [selectedId, carparkKey, hasSearched]);

  return null;
}
