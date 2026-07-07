import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { fetchBuildingTile, getTilesForBounds } from '../../../providers/osm';
import type { BuildingFeature } from '../../../providers/osm';

declare global {
  interface Window { OSMBuildings: any }
}

const minZoom = 16;

function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function OSMBuildingLayer() {
  const map = useMap();
  const buildingsRef = useRef<any>(null);
  const [ready, setReady] = useState(!!window.OSMBuildings);
  const featuresRef = useRef<BuildingFeature[]>([]);
  const loadedTilesRef = useRef(new Set<string>());
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.OSMBuildings) { setReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/osmbuildings@0.2.0-b/dist/OSMBuildings-Leaflet.js';
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const osm = new window.OSMBuildings(map);
    osm.style({ color: '#ececec', roofColor: '#dedede', shadows: true, height: 'height' });
    buildingsRef.current = osm;

    return () => {
      if (buildingsRef.current) { map.removeLayer(buildingsRef.current); buildingsRef.current = null; }
    };
  }, [ready, map]);

  const renderBuildings = useCallback(() => {
    if (!buildingsRef.current || featuresRef.current.length === 0) return;
    const selectedId = selectedIdRef.current;
    const colored = featuresRef.current.map((f: BuildingFeature) => {
      const isSelected = selectedId !== null && f.properties.id === selectedId;
      return {
        ...f,
        properties: { ...f.properties, color: isSelected ? '#ef4444' : '#ececec', roofColor: isSelected ? '#b91c1c' : '#dedede' },
      };
    });

    buildingsRef.current.set({ type: 'FeatureCollection', features: colored });
  }, []);

  const loadVisibleBuildings = useCallback(async () => {
    if (!buildingsRef.current || Math.floor(map.getZoom()) < minZoom) return;

    const bounds = map.getBounds();
    const { z, tiles } = getTilesForBounds({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() });

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
            if (!existingIds.has(f.properties.id)) featuresRef.current.push(f);
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
    if (ready && buildingsRef.current) loadVisibleBuildings();
  }, [ready, loadVisibleBuildings]);

  useMapEvents({
    zoomend: () => {
      if (!buildingsRef.current) return;
      if (Math.floor(map.getZoom()) > minZoom) loadVisibleBuildings();
    },
    moveend: () => {
      if (Math.floor(map.getZoom()) > minZoom) loadVisibleBuildings();
    },
    click: (e) => {
      if (Math.floor(map.getZoom()) < minZoom) return;

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
