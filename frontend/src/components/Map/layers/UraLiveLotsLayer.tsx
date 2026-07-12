import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchUraLiveLots } from '../../../providers/ura';
import type { UraLiveLot } from '../../../providers/ura';

const REFRESH_MS = 3 * 60 * 1000;

const LOT_TYPE_LABELS: Record<string, string> = {
  C: 'Car',
  M: 'Motorcycle',
  H: 'Heavy Vehicle',
};

interface CarparkLots {
  carparkNo: string;
  lat: number;
  lng: number;
  lots: { lotType: string; lotsAvailable: number }[];
}

function groupByCarpark(lots: UraLiveLot[]): CarparkLots[] {
  const grouped = new Map<string, CarparkLots>();
  for (const lot of lots) {
    const existing = grouped.get(lot.carparkNo);
    if (existing) {
      existing.lots.push({ lotType: lot.lotType, lotsAvailable: lot.lotsAvailable });
    } else {
      grouped.set(lot.carparkNo, {
        carparkNo: lot.carparkNo,
        lat: lot.lat,
        lng: lot.lng,
        lots: [{ lotType: lot.lotType, lotsAvailable: lot.lotsAvailable }],
      });
    }
  }
  return [...grouped.values()];
}

function displayCount(carpark: CarparkLots): number {
  const carLots = carpark.lots.find((l) => l.lotType === 'C');
  return (carLots ?? carpark.lots[0]).lotsAvailable;
}

function markerColor(available: number): string {
  if (available <= 0) return '#dc2626';
  if (available < 10) return '#f59e0b';
  return '#16a34a';
}

function buildPopupHtml(carpark: CarparkLots): string {
  const rows = carpark.lots
    .map(
      (l) =>
        `<p style="font-size:11px;color:#374151;margin:0;display:flex;justify-content:space-between;gap:12px">
          <span>${LOT_TYPE_LABELS[l.lotType] ?? l.lotType}</span>
          <span style="font-weight:800;color:${markerColor(l.lotsAvailable)}">${l.lotsAvailable} lots</span>
        </p>`
    )
    .join('');
  return `<div style="font-family:system-ui;min-width:130px">
    <p style="font-weight:900;font-size:12px;margin:0 0 2px">URA Carpark ${carpark.carparkNo}</p>
    <p style="font-size:10px;color:#9ca3af;font-weight:700;margin:0 0 5px">Live availability</p>
    ${rows}
  </div>`;
}

function buildMarker(carpark: CarparkLots): L.CircleMarker {
  return L.circleMarker([carpark.lat, carpark.lng], {
    radius: 6,
    color: 'white',
    weight: 1.5,
    fillColor: markerColor(displayCount(carpark)),
    fillOpacity: 0.85,
  }).bindPopup(buildPopupHtml(carpark));
}

export function UraLiveLotsLayer() {
  const map = useMap();

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    let cancelled = false;

    const load = () => {
      fetchUraLiveLots()
        .then((lots) => {
          if (cancelled) return;
          group.clearLayers();
          groupByCarpark(lots).forEach((carpark) => buildMarker(carpark).addTo(group));
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      map.removeLayer(group);
    };
  }, [map]);

  return null;
}
