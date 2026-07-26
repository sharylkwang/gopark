import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { fetchBuildingTile, getTilesForBounds } from '../../../providers/osm';
import type { BuildingFeature } from '../../../providers/osm';

declare global {
  interface Window { OSMBuildings: any }
}

const minZoom = 16, zoomEps = 0.5;

type Bounds = { north: number; south: number; east: number; west: number };
type Cell = { feature: BuildingFeature; minLng: number; minLat: number; maxLng: number; maxLat: number };
type Tile = { cells: Cell[]; touched: number };

function cellOf(feature: BuildingFeature): Cell {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const ring of feature.geometry.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { feature, minLng, minLat, maxLng, maxLat };
}

function inView(cell: Cell, b: Bounds): boolean {
  return cell.minLng <= b.east && cell.maxLng >= b.west && cell.minLat <= b.north && cell.maxLat >= b.south;
}

function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface BuildingStatus {
  state: 'loading' | 'ready' | 'error';
  count: number;
}

export function OSMBuildingLayer({ darkMode = false, retryToken = 0, onStatus }: {
  darkMode?: boolean;
  retryToken?: number;
  onStatus?: (status: BuildingStatus) => void;
}) {
  const map = useMap();
  const buildingsRef = useRef<any>(null);
  const [ready, setReady] = useState(!!window.OSMBuildings);
  const tilesRef = useRef<Map<string, Tile>>(new Map());
  const selectedIdRef = useRef<number | null>(null);
  const palette = darkMode ? { wall: '#3a424c', roof: '#2b323a' } : { wall: '#ececec', roof: '#dedede' };
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const statusRef = useRef<(s: BuildingStatus) => void>(() => {});
  statusRef.current = onStatus ?? (() => {});
  const failedTilesRef = useRef<Map<string, number>>(new Map());
  const circuitOpenRef = useRef(false);

  useEffect(() => {
    if (window.OSMBuildings) { setReady(true); return; }
    statusRef.current({ state: 'loading', count: 0 });

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/osmbuildings@0.2.0-b/dist/OSMBuildings-Leaflet.js';
    script.onload = () => setReady(true);
    script.onerror = () => statusRef.current({ state: 'error', count: 0 });
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const anyMap = map as unknown as { _zoomAnimated: boolean };
    const prevAnimation = map.options.zoomAnimation;
    const prevAnimated = anyMap._zoomAnimated;
    const prevSnap = map.options.zoomSnap;
    map.options.zoomAnimation = false;
    anyMap._zoomAnimated = false;
    map.options.zoomSnap = 1;
    if (!Number.isInteger(map.getZoom())) map.setZoom(Math.round(map.getZoom()), { animate: false });

    const osm = new window.OSMBuildings(map);
    osm.style({ color: paletteRef.current.wall, roofColor: paletteRef.current.roof, shadows: true, height: 'height' });
    buildingsRef.current = osm;

    return () => {
      map.options.zoomAnimation = prevAnimation;
      anyMap._zoomAnimated = prevAnimated;
      map.options.zoomSnap = prevSnap;
      if (buildingsRef.current) { map.removeLayer(buildingsRef.current); buildingsRef.current = null; }
    };
  }, [ready, map]);

  const renderViewport = useCallback(() => {
    if (!buildingsRef.current) return;

    const raw = map.getBounds().pad(0.2);
    const view: Bounds = { north: raw.getNorth(), south: raw.getSouth(), east: raw.getEast(), west: raw.getWest() };
    const selectedId = selectedIdRef.current;
    const { wall, roof } = paletteRef.current;

    const seen = new Set<number>();
    const features: BuildingFeature[] = [];
    for (const tile of tilesRef.current.values()) {
      for (const cell of tile.cells) {
        if (!inView(cell, view)) continue;
        const id = cell.feature.properties.id;
        if (seen.has(id)) continue;
        seen.add(id);
        const isSelected = selectedId !== null && id === selectedId;
        features.push({
          ...cell.feature,
          properties: { ...cell.feature.properties, color: isSelected ? '#facc15' : wall, roofColor: isSelected ? '#eab308' : roof },
        });
      }
    }

    buildingsRef.current.set({ type: 'FeatureCollection', features });
    return features.length;
  }, [map]);

  useEffect(() => {
    if (!buildingsRef.current) return;
    buildingsRef.current.style({ color: palette.wall, roofColor: palette.roof, shadows: true, height: 'height' });
    renderViewport();
  }, [palette.wall, palette.roof, renderViewport]);

  const loadViewport = useCallback(async () => {
    if (!buildingsRef.current || circuitOpenRef.current || map.getZoom() < minZoom - zoomEps) return;

    const bounds = map.getBounds();
    const { z, tiles } = getTilesForBounds({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() });

    const now = Date.now();
    const visibleKeys = new Set(tiles.map(({ x, y }) => `${z}/${x}/${y}`));

    for (const key of visibleKeys) {
      const tile = tilesRef.current.get(key);
      if (tile) tile.touched = now;
    }

    const pending = tiles.filter(({ x, y }) => {
      const key = `${z}/${x}/${y}`;
      if (tilesRef.current.has(key)) return false;
      const failedAt = failedTilesRef.current.get(key);
      return !(failedAt && now - failedAt < 60000);
    });

    renderViewport();

    if (!pending.length) { statusRef.current({ state: 'ready', count: tilesRef.current.size }); return; }
    statusRef.current({ state: 'loading', count: tilesRef.current.size });

    let hasNew = false, failed = 0;

    for (const { x, y } of pending) {
      const key = `${z}/${x}/${y}`;
      tilesRef.current.set(key, { cells: [], touched: Date.now() });

      try {
        const features = await fetchBuildingTile(z, x, y);
        failedTilesRef.current.delete(key);
        tilesRef.current.set(key, { cells: features.map(cellOf), touched: Date.now() });
        if (features.length > 0) hasNew = true;
      } catch {
        tilesRef.current.delete(key);
        failedTilesRef.current.set(key, Date.now());
        failed++;
        if (failed >= 2 && !hasNew) break;
      }
    }

    if (tilesRef.current.size > 12) {
      const evictable = [...tilesRef.current.entries()]
        .filter(([key]) => !visibleKeys.has(key))
        .sort((a, b) => a[1].touched - b[1].touched);
      let excess = tilesRef.current.size - 12;
      for (const [key] of evictable) { if (excess-- <= 0) break; tilesRef.current.delete(key); }
    }

    const shown = renderViewport() ?? 0;

    if (failed > 0 && shown === 0 && tilesRef.current.size === 0) {
      circuitOpenRef.current = true;
      statusRef.current({ state: 'error', count: 0 });
    } else {
      statusRef.current({ state: 'ready', count: shown });
    }
  }, [map, renderViewport]);

  useEffect(() => {
    if (!ready || !buildingsRef.current) return;
    if (map.getZoom() < minZoom - zoomEps) {
      map.flyTo(map.getCenter(), minZoom, { duration: 0.8 });
      return;
    }
    loadViewport();
  }, [ready, map, loadViewport]);

  useEffect(() => {
    if (!retryToken || !ready) return;
    failedTilesRef.current.clear();
    circuitOpenRef.current = false;
    loadViewport();
  }, [retryToken, ready, loadViewport]);

  useMapEvents({
    zoomend: () => {
      if (!buildingsRef.current) return;
      if (map.getZoom() >= minZoom - zoomEps) loadViewport();
    },
    moveend: () => {
      if (map.getZoom() >= minZoom - zoomEps) loadViewport();
    },
    click: (e) => {
      if (map.getZoom() < minZoom - zoomEps) return;

      const clicked: [number, number] = [e.latlng.lng, e.latlng.lat];
      let hit: number | null = null;
      outer:
      for (const tile of tilesRef.current.values()) {
        for (const cell of tile.cells) {
          if (clicked[0] < cell.minLng || clicked[0] > cell.maxLng || clicked[1] < cell.minLat || clicked[1] > cell.maxLat) continue;
          const ring = cell.feature.geometry?.coordinates?.[0];
          if (ring && pointInPolygon(clicked, ring as [number, number][])) { hit = cell.feature.properties.id; break outer; }
        }
      }

      selectedIdRef.current = hit;
      renderViewport();
    },
  });

  return null;
}
