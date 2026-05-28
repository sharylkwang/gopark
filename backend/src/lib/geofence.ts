import { readFileSync } from 'fs';
import path from 'path';

interface MultiPolygon {
  type: string;
  coordinates: number[][][][];
}

let border: MultiPolygon | null = null;

function load(): MultiPolygon {
  if (border) return border;
  const raw = JSON.parse(readFileSync(path.resolve('data/singapore.geojson'), 'utf-8'));
  border = raw.features[0].geometry as MultiPolygon;
  return border;
}

function raycast(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isInSingapore(lat: number, lng: number): boolean {
  const geo = load();
  for (const polygon of geo.coordinates) {
    if (raycast(lat, lng, polygon[0])) return true;
  }
  return false;
}
