import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { BuildingFeature } from '../../../services/buildings';

declare global {
  interface Window {
    OSMBuildings: any;
  }
}

const CDN_URL = 'https://cdn.jsdelivr.net/npm/osmbuildings@0.2.0-b/dist/OSMBuildings-Leaflet.js';
const BUILDINGS_DATA_URL = 'https://{s}.data.osmbuildings.org/0.2/59fcc2e8/tile/{z}/{x}/{y}.json';
const MIN_ZOOM = 15;

const HIGHLIGHT_STYLE: L.PathOptions = {
  color: '#ef4444',
  weight: 2,
  fillColor: '#ef4444',
  fillOpacity: 0.45,
};

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

export function OSMBuildingLayer() {
  const map = useMap();
  const buildingsRef = useRef<any>(null);
  const [ready, setReady] = useState(!!window.OSMBuildings);
  const featuresRef = useRef<BuildingFeature[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingFeature | null>(null);

  useEffect(() => {
    if (window.OSMBuildings) {
      setReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = CDN_URL;
    script.onload = () => {
      installXhrInterceptor();
      setReady(true);
    };
    document.head.appendChild(script);
  }, []);

  const installXhrInterceptor = () => {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
      (this as any)._osmUrl = typeof url === 'string' ? url : url.toString();
      return originalOpen.apply(this, [method, url, ...args] as any);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const url = (this as any)._osmUrl;
      if (url && typeof url === 'string' && (url.includes('osmbuildings') || url.includes('.json'))) {
        const origHandler = this.onreadystatechange;
        this.onreadystatechange = function (this: XMLHttpRequest, ev: Event) {
          if (this.readyState === 4 && this.status === 200) {
            try {
              const json = JSON.parse(this.responseText);
              if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
                const existing = new Set(featuresRef.current.map((f: BuildingFeature) => f.properties?.id));
                for (const f of json.features) {
                  const id = f.properties?.id || f.id;
                  if (!existing.has(id)) {
                    featuresRef.current.push(f);
                    existing.add(id);
                  }
                }
              }
            } catch {}
          }
          if (origHandler) origHandler.call(this, ev);
        };
      }
      return originalSend.call(this, body);
    };
  };

  useEffect(() => {
    if (!ready) return;

    const osm = new window.OSMBuildings(map);
    osm.load(BUILDINGS_DATA_URL);
    buildingsRef.current = osm;

    return () => {
      if (buildingsRef.current) {
        map.removeLayer(buildingsRef.current);
        buildingsRef.current = null;
      }
    };
  }, [ready, map]);

  useMapEvents({
    click: (e: L.LeafletMouseEvent) => {
      if (map.getZoom() < MIN_ZOOM) return;

      const clicked: [number, number] = [e.latlng.lng, e.latlng.lat];
      const found = featuresRef.current.find((feature: BuildingFeature) => {
        const rings = feature.geometry?.coordinates;
        if (!rings?.[0]) return false;
        return pointInPolygon(clicked, rings[0] as [number, number][]);
      });

      setSelectedBuilding(found || null);
    },
  });

  if (!selectedBuilding) return null;

  return (
    <GeoJSON
      key={selectedBuilding.properties.id}
      data={selectedBuilding}
      style={() => HIGHLIGHT_STYLE}
    />
  );
}
