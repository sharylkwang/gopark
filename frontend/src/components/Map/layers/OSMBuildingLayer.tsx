import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { fetchBuildingTile, getTilesForBounds } from '../../../providers/osm';
import type { BuildingFeature } from '../../../providers/osm';

declare global {
  interface Window {
    OSMBuildings: any;
  }
}

const CDN_URL = 'https://cdn.jsdelivr.net/npm/osmbuildings@0.2.0-b/dist/OSMBuildings-Leaflet.js';
const MIN_ZOOM = 16;
const ZOOM_EPSILON = 0.5;
const FAIL_COOLDOWN_MS = 60000;
const VIEWPORT_PAD = 0.2;
const KEEP_TILES = 12;

const PALETTE = {
  light: { wall: '#ececec', roof: '#dedede' },
  dark: { wall: '#3a424c', roof: '#2b323a' },
};
const HIGHLIGHT_COLOR = '#facc15';
const HIGHLIGHT_ROOF = '#eab308';

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
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
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
  const palette = darkMode ? PALETTE.dark : PALETTE.light;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const statusRef = useRef<(s: BuildingStatus) => void>(() => {});
  statusRef.current = onStatus ?? (() => {});
  const failedTilesRef = useRef<Map<string, number>>(new Map());
  const circuitOpenRef = useRef(false);

  useEffect(() => {
    if (window.OSMBuildings) {
      setReady(true);
      return;
    }
    statusRef.current({ state: 'loading', count: 0 });

    const script = document.createElement('script');
    script.src = CDN_URL;
    script.onload = () => setReady(true);
    script.onerror = () => statusRef.current({ state: 'error', count: 0 });
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const anyMap = map as unknown as { _zoomAnimated: boolean };
    const prevAnimation = map.options.zoomAnimation;
    const prevAnimated = anyMap._zoomAnimated;
    map.options.zoomAnimation = false;
    anyMap._zoomAnimated = false;

    const osm = new window.OSMBuildings(map);
    osm.style({
      color: paletteRef.current.wall,
      roofColor: paletteRef.current.roof,
      shadows: true,
      height: 'height',
    });
    buildingsRef.current = osm;

    return () => {
      map.options.zoomAnimation = prevAnimation;
      anyMap._zoomAnimated = prevAnimated;
      if (buildingsRef.current) {
        map.removeLayer(buildingsRef.current);
        buildingsRef.current = null;
      }
    };
  }, [ready, map]);

  const renderViewport = useCallback(() => {
    if (!buildingsRef.current) return;

    const raw = map.getBounds().pad(VIEWPORT_PAD);
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
          properties: {
            ...cell.feature.properties,
            color: isSelected ? HIGHLIGHT_COLOR : wall,
            roofColor: isSelected ? HIGHLIGHT_ROOF : roof,
          },
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
    if (!buildingsRef.current || circuitOpenRef.current || map.getZoom() < MIN_ZOOM - ZOOM_EPSILON) return;

    const bounds = map.getBounds();
    const { z, tiles } = getTilesForBounds({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });

    let hasNew = false;

    for (const { x, y } of tiles) {
      const key = `${z}/${x}/${y}`;
      if (loadedTilesRef.current.has(key)) continue;
      loadedTilesRef.current.add(key);

      try {
        const features = await fetchBuildingTile(z, x, y);
        if (features.length > 0) {
          const existingIds = new Set(featuresRef.current.map((f: BuildingFeature) => f.properties.id));
          for (const f of features) {
            if (!existingIds.has(f.properties.id)) {
              featuresRef.current.push(f);
            }
          }
          hasNew = true;
        }
      } catch {
        loadedTilesRef.current.delete(key);
      }
    }

    if (hasNew) renderBuildings();
  }, [map, renderBuildings]);

  useEffect(() => {
    if (ready && buildingsRef.current) {
      loadVisibleBuildings();
    }
  }, [ready, loadVisibleBuildings]);

  useMapEvents({
    zoomend: () => {
      if (!buildingsRef.current) return;
      if (Math.floor(map.getZoom()) > MIN_ZOOM) {
        loadVisibleBuildings();
      }
    },
    moveend: () => {
      if (Math.floor(map.getZoom()) > MIN_ZOOM) loadVisibleBuildings();
    },
    click: (e) => {
      if (Math.floor(map.getZoom()) < MIN_ZOOM) return;

      const clicked: [number, number] = [e.latlng.lng, e.latlng.lat];
      const found = featuresRef.current.find((feature: BuildingFeature) => {
        const rings = feature.geometry?.coordinates;
        if (!rings?.[0]) return false;
        return pointInPolygon(clicked, rings[0] as [number, number][]);
      });

      selectedIdRef.current = found ? found.properties.id : null;
      renderBuildings();
    },
  });

  return null;
}
