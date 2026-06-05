import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { CarparkSummary } from '../../types';

function availColor(cp: CarparkSummary): string {
  const entries = Object.values(cp.availability);
  if (!entries.length) return '#9ca3af';
  const avail = entries.reduce((s, e) => s + (e.available ?? 0), 0);
  const total = entries.reduce((s, e) => s + (e.total ?? 0), 0);
  if (!total) return '#3b82f6';
  const pct = (avail / total) * 100;
  if (pct > 30) return '#22c55e';
  if (pct > 10) return '#f59e0b';
  return '#ef4444';
}

function pin(color: string, size: number) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid rgba(255,255,255,0.8);box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer"></div>`,
  });
}

function clusterIcon(count: number, zoom: number) {
  const base = zoom < 13 ? 52 : zoom < 15 ? 46 : zoom < 17 ? 40 : 36;
  const scale = Math.min(1 + Math.log10(count) * 0.15, 1.4);
  const size = Math.round(base * scale);
  const bg = count > 100 ? '#dc2626' : count > 30 ? '#ef4444' : count > 10 ? '#f59e0b' : '#3b82f6';
  const label = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:white;font-weight:900;font-size:${size < 40 ? 11 : 13}px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">${label}</div>`,
  });
}

interface Props {
  carparks: CarparkSummary[];
  selectedId: string | null; 
  onSelect: (id: string) => void;
}

export function MarkerCluster({ carparks, selectedId, onSelect }: Props) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterRef.current) map.removeLayer(clusterRef.current);

    const cluster = L.markerClusterGroup({
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
      animate: true,
      animateAddingMarkers: false,
      iconCreateFunction: (c) => clusterIcon(c.getChildCount(), map.getZoom()),
    });

    for (const cp of carparks) {
      const isSelected = cp.id === selectedId;
      
      const markerColor = isSelected ? '#dc2626' : availColor(cp);
      const markerSize = isSelected ? 32 : 24; 

      const marker = L.marker([cp.lat, cp.lng], { icon: pin(markerColor, markerSize) });
      marker.on('click', () => onSelect(cp.id));
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => { map.removeLayer(cluster); clusterRef.current = null; };
  }, [carparks, selectedId, onSelect, map]);

  return null;
}
