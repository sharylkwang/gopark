import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import { CameraFlyer } from './CameraFlyer';
import { EventHandler } from './EventHandler';
import { MarkerCluster } from './MarkerCluster';
import { SingaporeBoundary } from './layers/SingaporeBoundary';
import { OSMBuildingLayer } from './layers/OSMBuildingLayer';
import type { BuildingStatus } from './layers/OSMBuildingLayer';
import { TileLayerSwitcher } from './TileLayerSwitcher';
import { Google3DMap } from './layers/Google3DMap';
import type { Map3DMode } from './layers/Google3DMap';
import { getTileProvider, DEFAULT_TILE } from '../../providers/tiles';
import { reverseGeocode } from '../../providers/geoapify';
import type { CarparkSummary, DestinationPoint, NearbyParking } from '../../types';
import type { LayoutMode } from '../../hooks/useLayoutMode';
import type { MapEventHandlers } from '../../types/map';
import type { RouteResult, SpeedInterval } from '../../providers/google/routing';
import { formatDuration, parseDurationSecs } from '../../utils/format';

const SPEED_COLORS: Record<string, string> = {
  NORMAL: '#22c55e',
  SLOW: '#f59e0b',
  TRAFFIC_JAM: '#dc2626',
};

const TRAFFIC_DOT: Record<string, string> = {
  NORMAL: '#22c55e',
  MODERATE: '#f59e0b',
  HEAVY: '#dc2626',
};

function midpoint(points: [number, number][]): [number, number] {
  const idx = Math.floor(points.length * 0.4);
  return points[idx] || points[0];
}

const DRIVE_OUTLINE = { color: '#1a1a2e', weight: 10, opacity: 0.3 };
const DRIVE_LINE = { color: '#4285f4', weight: 6, opacity: 0.9 };

const WALK_STYLES = {
  outline: { color: '#1e40af', weight: 8, opacity: 0.2 },
  line: { color: '#3b82f6', weight: 5, opacity: 1, dashArray: '2, 10', lineCap: 'round' as const },
  bfaOutline: { color: '#6d28d9', weight: 8, opacity: 0.2 },
  bfaLine: { color: '#8b5cf6', weight: 5, opacity: 1, dashArray: '2, 10', lineCap: 'round' as const },
};

function WalkRoute({ polyline, isBfa }: { polyline: [number, number][]; isBfa?: boolean }) {
  const outline = isBfa ? WALK_STYLES.bfaOutline : WALK_STYLES.outline;
  const line = isBfa ? WALK_STYLES.bfaLine : WALK_STYLES.line;
  return (
    <>
      <Polyline positions={polyline} pathOptions={outline} />
      <Polyline positions={polyline} pathOptions={line} />
    </>
  );
}

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
const WALK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1.5"/><path d="M9 20l2-5"/><path d="M15 20l-2-5-2-4 3-2 2 4h3"/><path d="M6 9l3 2"/></svg>`;


function makePill(time: string, svg: string, bg: string, border: string, textColor: string, dotColor?: string) {
  const dot = dotColor
    ? `<span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>`
    : '';
  return L.divIcon({
    className: 'route-pill-wrapper',
    html: `<div class="route-pill" style="
      display:inline-flex;align-items:center;gap:5px;
      background:${bg};border:2px solid ${border};
      border-radius:20px;padding:5px 12px 5px 8px;
      box-shadow:0 2px 10px rgba(0,0,0,0.25);
      cursor:pointer;white-space:nowrap;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <span style="display:flex;color:${textColor};">${svg}</span>
      <span style="font-size:13px;font-weight:800;color:${textColor};line-height:1;">${time}</span>
      ${dot}
    </div>`,
    iconSize: [120, 30],
    iconAnchor: [60, 15],
  });
}

const getDestinationPin = () => {
  return L.divIcon({
    className: 'destination-pin',
    html: `<div class="dest-inner" style="position:relative;transition:transform 0.25s ease-out,filter 0.25s ease-out;">
      <span class="dest-pulse"></span>
      <div style="
        width: 40px;
        height: 40px;
        background: #dc2626;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 4px solid white;
        box-shadow: 0 3px 12px rgba(220,38,38,0.5);
        position: relative;
        z-index: 2;
      ">
        <div style="
          position:absolute;inset:0;
          display:flex;align-items:center;justify-content:center;
          transform:rotate(45deg);
        ">
          <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='white' stroke='white' stroke-width='0'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z'/><circle cx='12' cy='10' r='3' fill='#dc2626'/></svg>
        </div>
      </div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -42]
  });
};

const getStartPin = () => {
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div style="
      width: 32px; height: 32px;
      background: #2563eb;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(37,99,235,0.4);
    ">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);">
        <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><polyline points='12 6 12 12 16 14'/></svg>
      </div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34]
  });
};

const getUserDot = () => {
  return L.divIcon({
    className: 'user-location-icon',
    html: `<span class="user-dot-pulse"></span><span class="user-dot"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -12],
  });
};

interface Props {
  carparks: CarparkSummary[];
  backgroundCarparks?: CarparkSummary[];
  selectedId: string | null;
  destinationPoint: DestinationPoint | null;
  hasSearched: boolean;
  onSelectCarpark: (id: string) => void;
  eventHandlers?: MapEventHandlers;
  onDestinationDrag?: (lat: number, lng: number) => void;
  userLocation?: [number, number] | null;
  drivePolyline?: [number, number][] | null;
  driveRoute?: RouteResult | null;
  walkPolyline?: [number, number][] | null;
  walkRoute?: RouteResult | null;
  startCoords?: [number, number] | null;
  sidebarOpen?: boolean;
  nearbyParking?: NearbyParking[];
  layout?: LayoutMode;
  hideSwitcher?: boolean;
  darkMode?: boolean;
  focusPoint?: FocusPoint | null;
  vehicleType?: string;
  recommendedId?: string | null;
  onMapReady?: (map: L.Map) => void;
}

export interface FocusPoint {
  lat: number;
  lng: number;
  token: number;
}

const DARK_TILE = 'carto-dark';

function MapResizer({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [sidebarOpen]);
  return null;
}

function FocusFlyer({ point }: { point: FocusPoint | null }) {
  const map = useMap();
  const lastToken = useRef<number>(0);

  useEffect(() => {
    if (!point || point.token === lastToken.current) return;
    lastToken.current = point.token;
    map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 16), { duration: 1 });
  }, [point, map]);

  return null;
}

function MapHandle({ onReady }: { onReady?: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onReady?.(map); }, [map, onReady]);
  return null;
}

function PositionTracker({ onMove }: { onMove: (center: { lat: number; lng: number }, zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      onMove({ lat: c.lat, lng: c.lng }, map.getZoom());
    };
    map.on('moveend', handler);
    map.on('zoomend', handler);
    return () => { map.off('moveend', handler); map.off('zoomend', handler); };
  }, [map, onMove]);
  return null;
}

function getParkingSpotIcon(index: number, animate: boolean) {
  const size = 24;
  const hit = size + 14;
  const stem = 8;
  const delay = index * 80;
  const dropClass = animate ? 'nearby-parking-drop' : '';
  const delayStyle = animate ? `animation-delay:${delay}ms;` : '';

  return L.divIcon({
    className: '',
    iconSize: [hit, hit],
    iconAnchor: [hit / 2, hit],
    popupAnchor: [0, -hit],
    html: `<div class="${dropClass}" style="width:${hit}px;height:${hit}px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35));${delayStyle}">
      <div style="width:${size}px;height:${size}px;background:#ffffff;border:2.5px dashed #475569;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#0d1013;font-weight:900;font-size:13px;font-family:Inter,system-ui,sans-serif;pointer-events:none">P</div>
      <div style="width:${stem}px;height:${stem}px;margin-top:-5px;background:#ffffff;border-right:2.5px solid #475569;border-bottom:2.5px solid #475569;border-bottom-right-radius:2px;transform:rotate(45deg);pointer-events:none"></div>
    </div>`,
  });
}

function NearbyParkingMarkers({ spots }: { spots: NearbyParking[] }) {
  const icons = useMemo(() => spots.map((_, i) => getParkingSpotIcon(i, true)), [spots]);

  return (
    <>
      {spots.map((p, i) => (
        <Marker key={`np-${i}`} position={[p.lat, p.lng]} icon={icons[i]} zIndexOffset={800}>
          <Popup>
            <div style={{ fontFamily: 'system-ui', minWidth: 140 }}>
              <p style={{ fontWeight: 900, fontSize: 13, margin: '0 0 2px' }}>{p.name || 'Parking'}</p>
              <p style={{ fontSize: 11, color: '#f97316', fontWeight: 700, margin: '0 0 4px' }}>{p.type}</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                {p.access === 'private' ? 'Private access' : p.access === 'permissive' ? 'Restricted access' : p.access === 'yes' ? 'Public access' : 'Access unknown'}
                {p.capacity ? ` · ${p.capacity} lots` : ''}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function TrafficPolyline({ points, intervals }: { points: [number, number][]; intervals: SpeedInterval[] }) {
  return (
    <>
      {intervals.map((seg, i) => {
        const start = seg.startPolylinePointIndex ?? 0;
        const end = seg.endPolylinePointIndex ?? 0;
        if (end <= start || start >= points.length) return null;
        const segment = points.slice(start, Math.min(end + 1, points.length));
        if (segment.length < 2) return null;
        return (
          <Polyline
            key={i}
            positions={segment}
            pathOptions={{ color: SPEED_COLORS[seg.speed] || SPEED_COLORS.NORMAL, weight: 6, opacity: 0.9 }}
          />
        );
      })}
    </>
  );
}

function makeCombinedPill(driveTime: string, walkTime: string) {
  return L.divIcon({
    className: 'route-pill-wrapper',
    html: `<div class="route-pill" style="
      display:inline-flex;align-items:center;gap:8px;
      background:white;border:2px solid #d1d5db;
      border-radius:20px;padding:5px 12px;
      box-shadow:0 2px 10px rgba(0,0,0,0.25);
      cursor:pointer;white-space:nowrap;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="display:flex;color:#111827;">${CAR_SVG}</span>
        <span style="font-size:13px;font-weight:800;color:#111827;line-height:1;">${driveTime}</span>
      </span>
      <span style="width:1px;height:16px;background:#d1d5db;"></span>
      <span style="display:flex;align-items:center;gap:4px;">
        <span style="display:flex;color:#1e40af;">${WALK_SVG}</span>
        <span style="font-size:13px;font-weight:800;color:#1e40af;line-height:1;">${walkTime}</span>
      </span>
    </div>`,
    iconSize: [200, 30],
    iconAnchor: [100, 15],
  });
}

function RouteLabel({ position, route, type }: {
  position: [number, number];
  route: RouteResult;
  type: 'drive' | 'walk';
}) {
  const time = formatDuration(parseDurationSecs(route.duration));
  const isDrive = type === 'drive';
  const trafficDot = isDrive ? (TRAFFIC_DOT[route.trafficCondition] || '') : '';
  const svg = isDrive ? CAR_SVG : WALK_SVG;

  const icon = makePill(time, svg, 'white', isDrive ? '#d1d5db' : '#93c5fd', isDrive ? '#111827' : '#1e40af', isDrive ? trafficDot : undefined);

  return <Marker position={position} icon={icon} zIndexOffset={1000} />;
}

function CombinedRouteLabel({ position, driveRoute, walkRoute }: {
  position: [number, number];
  driveRoute: RouteResult;
  walkRoute: RouteResult;
}) {
  const driveTime = formatDuration(parseDurationSecs(driveRoute.duration));
  const driveDist = formatDistance(driveRoute.distanceMeters);
  const walkTime = formatDuration(parseDurationSecs(walkRoute.duration));
  const walkDist = formatDistance(walkRoute.distanceMeters);
  const trafficLabel = TRAFFIC_LABELS[driveRoute.trafficCondition] || '';
  const trafficDot = TRAFFIC_DOT[driveRoute.trafficCondition] || '';

  const icon = makeCombinedPill(driveTime, walkTime);

  return (
    <Marker position={position} icon={icon} zIndexOffset={1000}>
      <Popup closeButton={false} className="route-popup" offset={[0, -5]}>
        <div style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 6, whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Drive</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>{driveTime}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{driveDist}</span>
            {trafficLabel && trafficDot && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: trafficDot, background: `${trafficDot}15`, padding: '2px 8px', borderRadius: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: trafficDot }} />
                {trafficLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Walk</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1e40af' }}>{walkTime}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{walkDist}</span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function RouteLabels({ drivePolyline, driveRoute, walkPolyline, walkRoute }: {
  drivePolyline: [number, number][] | null;
  driveRoute: RouteResult | null;
  walkPolyline: [number, number][] | null;
  walkRoute: RouteResult | null;
}) {
  const map = useMap();
  const [zoomed, setZoomed] = useState(map.getZoom() >= 15);

  useEffect(() => {
    const onZoom = () => setZoomed(map.getZoom() >= 15);
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [map]);

  const hasDrive = drivePolyline && driveRoute && drivePolyline.length > 1;
  const hasWalk = walkPolyline && walkRoute && walkPolyline.length > 1;

  if (!zoomed && hasDrive && hasWalk) {
    return (
      <CombinedRouteLabel
        position={midpoint(drivePolyline)}
        driveRoute={driveRoute}
        walkRoute={walkRoute}
      />
    );
  }

  return (
    <>
      {hasDrive && <RouteLabel position={midpoint(drivePolyline)} route={driveRoute} type="drive" />}
      {hasWalk && <RouteLabel position={midpoint(walkPolyline)} route={walkRoute} type="walk" />}
    </>
  );
}

function DraggableDestination({
  destinationPoint,
  onDragEnd,
}: {
  destinationPoint: DestinationPoint;
  onDragEnd?: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const tooltipRef = useRef<L.Tooltip | null>(null);
  const shadowRef = useRef<L.CircleMarker | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  useEffect(() => {
    const marker = L.marker(
      [destinationPoint.lat, destinationPoint.lng],
      { icon: getDestinationPin(), draggable: true, zIndexOffset: 2000 }
    );

    const shortAddr = destinationPoint.formatted
      .replace(/, Singapore$/i, '')
      .replace(/, Singapore \d{6}$/i, '')
      .split(', ')
      .slice(0, 2)
      .join(', ');

    marker.bindPopup(
      `<div style="font-family:system-ui,sans-serif;max-width:220px">
        <div style="font-size:14px;font-weight:900;color:#dc2626;margin-bottom:2px;line-height:1.3">${destinationPoint.name}</div>
        <div style="font-size:11px;color:#9ca3af;font-weight:600;line-height:1.3">${shortAddr}</div>
      </div>`,
      { closeButton: false, className: 'route-popup' }
    );

    marker.on('dragstart', () => {
      const el = marker.getElement();
      const inner = el?.querySelector('.dest-inner') as HTMLElement | null;
      if (inner) inner.classList.add('dest-dragging');

      marker.closePopup();

      const pos = marker.getLatLng();
      shadowRef.current = L.circleMarker(pos, {
        radius: 8,
        color: '#dc2626',
        fillColor: '#dc2626',
        fillOpacity: 0.3,
        weight: 2,
        dashArray: '4,4',
        className: 'dest-shadow',
      }).addTo(map);

      tooltipRef.current = L.tooltip({
        permanent: true,
        direction: 'top',
        offset: [0, -60],
        className: 'drag-tooltip',
      })
        .setLatLng(pos)
        .setContent('📍 Loading...')
        .addTo(map);

      reverseGeocode(pos.lat, pos.lng).then(place => {
        if (tooltipRef.current) {
          tooltipRef.current.setContent(`📍 ${place.name || place.formatted}`);
        }
      });
    });

    marker.on('drag', () => {
      const pos = marker.getLatLng();
      if (tooltipRef.current) {
        tooltipRef.current.setLatLng(pos);
      }
      if (shadowRef.current) {
        shadowRef.current.setLatLng(pos);
      }

      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      geocodeTimer.current = setTimeout(() => {
        reverseGeocode(pos.lat, pos.lng).then(place => {
          if (tooltipRef.current) {
            tooltipRef.current.setContent(`📍 ${place.name || place.formatted}`);
          }
        });
      }, 300);
    });

    marker.on('dragend', () => {
      const el = marker.getElement();
      const inner = el?.querySelector('.dest-inner') as HTMLElement | null;
      if (inner) inner.classList.remove('dest-dragging');

      if (geocodeTimer.current) {
        clearTimeout(geocodeTimer.current);
        geocodeTimer.current = null;
      }
      if (tooltipRef.current) {
        map.removeLayer(tooltipRef.current);
        tooltipRef.current = null;
      }
      if (shadowRef.current) {
        map.removeLayer(shadowRef.current);
        shadowRef.current = null;
      }

      const pos = marker.getLatLng();
      onDragEndRef.current?.(pos.lat, pos.lng);
    });

    marker.addTo(map);
    markerRef.current = marker;

    return () => {
      if (geocodeTimer.current) {
        clearTimeout(geocodeTimer.current);
        geocodeTimer.current = null;
      }
      map.removeLayer(marker);
      if (tooltipRef.current) {
        map.removeLayer(tooltipRef.current);
        tooltipRef.current = null;
      }
      if (shadowRef.current) {
        map.removeLayer(shadowRef.current);
        shadowRef.current = null;
      }
      markerRef.current = null;
    };
  }, [destinationPoint.lat, destinationPoint.lng, destinationPoint.name, map]);

  return null;
}

export function MapView({
  carparks, backgroundCarparks, selectedId, destinationPoint, hasSearched,
  onSelectCarpark, eventHandlers, onDestinationDrag, userLocation,
  drivePolyline, driveRoute, walkPolyline, walkRoute, startCoords, sidebarOpen,
  nearbyParking,
}: Props) {
  const [tileId, setTileId] = useState(DEFAULT_TILE);
  const [mode3D, setMode3D] = useState<Map3DMode | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 1.3521, lng: 103.8198 });
  const [mapZoom, setMapZoom] = useState(12);
  const tile = getTileProvider(tileId) ?? getTileProvider(DEFAULT_TILE)!;

  const handlePositionChange = useCallback((c: { lat: number; lng: number }, z: number) => {
    setMapCenter(c);
    setMapZoom(z);
  }, []);

  const dest3D = useMemo(() =>
    destinationPoint ? { lat: destinationPoint.lat, lng: destinationPoint.lng } : null,
  [destinationPoint?.lat, destinationPoint?.lng]);

  const routes3D = useMemo(() => [
    ...(drivePolyline && drivePolyline.length > 1
      ? [{
          polyline: drivePolyline,
          color: '#4285f4',
          width: 8,
          speedIntervals: driveRoute?.speedIntervals,
        }]
      : []),
    ...(walkPolyline && walkPolyline.length > 1
      ? [{
          polyline: walkPolyline,
          color: walkRoute?.travelMode === 'BFA' ? '#8b5cf6' : '#60a5fa',
          width: 5,
          dashed: true,
        }]
      : []),
  ], [drivePolyline, walkPolyline, walkRoute?.travelMode, driveRoute?.speedIntervals]);

  const markers3D = useMemo(() =>
    carparks.map(cp => ({
      lat: cp.lat,
      lng: cp.lng,
      color: cp.id === selectedId ? '#2563eb' : '#22c55e',
      label: cp.name,
      selected: cp.id === selectedId,
    })),
  [carparks, selectedId]);

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[1.3521, 103.8198]} zoom={12} className="h-full w-full z-0"
        zoomSnap={0} zoomDelta={1} wheelPxPerZoomLevel={60} zoomAnimation={true}
        doubleClickZoom={false}
        zoomControl={false} minZoom={11} maxZoom={19}
        maxBounds={new LatLngBounds([1.15, 103.59], [1.47, 104.12])} maxBoundsViscosity={1.0}
      >
        <MapResizer sidebarOpen={sidebarOpen} />
        <PositionTracker onMove={handlePositionChange} />
        <ZoomControl position="bottomright" />
        <TileLayer key={tile.id} url={tile.url} attribution={tile.attribution}
          maxZoom={tile.maxZoom} subdomains={tile.subdomains ?? []}
          tileSize={tile.tileSize ?? 256} zoomOffset={tile.zoomOffset ?? 0} />

        <CameraFlyer selectedId={selectedId} results={carparks} hasSearched={hasSearched}
          destinationPoint={destinationPoint} userLocation={userLocation} />

        <SingaporeBoundary />
        {eventHandlers && <EventHandler {...eventHandlers} />}

        {destinationPoint && (
          <DraggableDestination
            destinationPoint={destinationPoint}
            onDragEnd={onDestinationDrag}
          />
        )}

        {startCoords && (
          <Marker position={startCoords} icon={getStartPin()} zIndexOffset={1500}>
            <Popup closeButton={false} className="route-popup">
              <div style={{ fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#2563eb' }}>Start Point</span>
              </div>
            </Popup>
          </Marker>
        )}

        {userLocation && !startCoords && (
          <Marker position={userLocation} icon={getUserDot()}>
            <Popup closeButton={false} className="route-popup">
              <div style={{ fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#4285f4' }}>You are here</span>
              </div>
            </Popup>
          </Marker>
        )}

        {nearbyParking && <NearbyParkingMarkers spots={nearbyParking} />}

        <MarkerCluster carparks={carparks} backgroundCarparks={backgroundCarparks} selectedId={selectedId} onSelect={onSelectCarpark} hasSearched={hasSearched} />

        {drivePolyline && drivePolyline.length > 0 && (
          <>
            <Polyline positions={drivePolyline} pathOptions={DRIVE_OUTLINE} />
            {driveRoute?.speedIntervals && driveRoute.speedIntervals.length > 0
              ? <TrafficPolyline points={drivePolyline} intervals={driveRoute.speedIntervals} />
              : <Polyline positions={drivePolyline} pathOptions={DRIVE_LINE} />
            }
          </>
        )}

        {walkPolyline && walkPolyline.length > 0 && (
          <WalkRoute polyline={walkPolyline} isBfa={walkRoute?.travelMode === 'BFA'} />
        )}

        <RouteLabels
          drivePolyline={drivePolyline ?? null}
          driveRoute={driveRoute ?? null}
          walkPolyline={walkPolyline ?? null}
          walkRoute={walkRoute ?? null}
        />
      </MapContainer>

      {mode3D && (
        <Google3DMap
          mode={mode3D}
          center={dest3D || mapCenter}
          zoom={dest3D ? 16 : mapZoom}
          routes={routes3D}
          markers={markers3D}
          destination={dest3D}
        />
      )}

      <TileLayerSwitcher currentTile={tileId} onTileChange={setTileId}
        mode3D={mode3D} onMode3DChange={setMode3D}
        mapCenter={mapCenter} mapZoom={mapZoom} />
    </div>
  );
}
