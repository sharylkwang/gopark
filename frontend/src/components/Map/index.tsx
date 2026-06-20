import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Polyline, useMap } from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import { CameraFlyer } from './CameraFlyer';
import { EventHandler } from './EventHandler';
import { MarkerCluster } from './MarkerCluster';
import { OSMBuildingLayer } from './layers/OSMBuildingLayer';
import { SingaporeBoundary } from './layers/SingaporeBoundary';
import { TileLayerSwitcher } from './TileLayerSwitcher';
import { getTileProvider, DEFAULT_TILE } from '../../providers/tiles';
import type { CarparkSummary, DestinationPoint } from '../../types';
import type { MapEventHandlers } from '../../types/map';
import type { RouteResult, SpeedInterval } from '../../providers/google/routing';

const SPEED_COLORS: Record<string, string> = {
  NORMAL: '#22c55e',
  SLOW: '#f59e0b',
  TRAFFIC_JAM: '#dc2626',
};

const TRAFFIC_LABELS: Record<string, string> = {
  NORMAL: 'Light traffic',
  MODERATE: 'Moderate traffic',
  HEAVY: 'Heavy traffic',
};

const TRAFFIC_DOT: Record<string, string> = {
  NORMAL: '#22c55e',
  MODERATE: '#f59e0b',
  HEAVY: '#dc2626',
};

function parseDuration(dur: string) {
  const secs = parseInt(dur.replace('s', ''));
  if (secs < 60) return '<1 min';
  return `${Math.round(secs / 60)} min`;
}

function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

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
}

function MapResizer({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(t);
  }, [sidebarOpen]);
  return null;
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

function RouteLabel({ position, route, type }: {
  position: [number, number];
  route: RouteResult;
  type: 'drive' | 'walk';
}) {
  const time = parseDuration(route.duration);
  const dist = formatDist(route.distanceMeters);
  const trafficLabel = type === 'drive' ? (TRAFFIC_LABELS[route.trafficCondition] || '') : '';
  const trafficDot = type === 'drive' ? (TRAFFIC_DOT[route.trafficCondition] || '') : '';

  if (type !== 'drive') {
    const walkIcon = L.divIcon({
      className: 'route-pill-wrapper',
      html: `<div style="
        display:inline-flex;align-items:center;gap:6px;
        background:linear-gradient(135deg,#eff6ff,#e0e7ff);
        border:1.5px solid #93c5fd;
        border-radius:16px;padding:6px 12px;
        white-space:nowrap;cursor:default;
        font-family:system-ui,-apple-system,sans-serif;
      ">
        <span style="font-size:15px">&#x1F6B6;&#x200D;&#x2640;&#xFE0F;</span>
        <span style="font-size:14px;font-weight:900;color:#1e40af;line-height:1">${time}</span>
        <span style="font-size:11px;font-weight:700;color:#60a5fa;line-height:1">${dist}</span>
        <span style="font-size:12px">&#x2728;</span>
      </div>`,
      iconSize: [160, 34],
      iconAnchor: [80, 17],
    });

    return <Marker position={position} icon={walkIcon} zIndexOffset={1000} />;
  }

  const icon = makePill(time, CAR_SVG, 'white', '#d1d5db', '#111827', trafficDot);

  const trafficBit = trafficLabel
    ? `<span style="
        display:inline-flex;align-items:center;gap:4px;
        font-size:11px;font-weight:700;color:${trafficDot};
        background:${trafficDot}15;
        padding:2px 8px;border-radius:10px;
      ">
        <span style="width:6px;height:6px;border-radius:50%;background:${trafficDot}"></span>
        ${trafficLabel}
      </span>`
    : '';

  const popupHtml = `<div style="
    font-family:system-ui,sans-serif;
    display:flex;align-items:center;gap:10px;
    white-space:nowrap;
  ">
    <span style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Drive</span>
    <span style="font-size:16px;font-weight:900;color:#111827">${time}</span>
    <span style="font-size:12px;color:#9ca3af">${dist}</span>
    ${trafficBit}
  </div>`;

  return (
    <Marker position={position} icon={icon} zIndexOffset={1000}>
      <Popup closeButton={false} className="route-popup" offset={[0, -5]}>
        <div dangerouslySetInnerHTML={{ __html: popupHtml }} />
      </Popup>
    </Marker>
  );
}

function DraggableDestination({
  destinationPoint,
  onDragEnd,
}: {
  destinationPoint: DestinationPoint;
  onDragEnd?: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const onDragStart = () => {
      const el = marker.getElement();
      const inner = el?.querySelector('.dest-inner') as HTMLElement | null;
      if (inner) {
        inner.classList.add('dest-dragging');
      }
    };

    const onDragEndEvt = () => {
      const el = marker.getElement();
      const inner = el?.querySelector('.dest-inner') as HTMLElement | null;
      if (inner) {
        inner.classList.remove('dest-dragging');
      }
      const pos = marker.getLatLng();
      onDragEnd?.(pos.lat, pos.lng);
    };

    marker.on('dragstart', onDragStart);
    marker.on('dragend', onDragEndEvt);

    return () => {
      marker.off('dragstart', onDragStart);
      marker.off('dragend', onDragEndEvt);
    };
  }, [onDragEnd]);

  return (
    <Marker
      ref={markerRef}
      position={[destinationPoint.lat, destinationPoint.lng]}
      icon={getDestinationPin()}
      draggable={true}
      zIndexOffset={2000}
    >
      <Popup closeButton={false} className="route-popup">
        <div style={{ fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#dc2626', marginBottom: 2 }}>
            {destinationPoint.name}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
            {destinationPoint.formatted}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export function MapView({
  carparks, selectedId, destinationPoint, hasSearched,
  onSelectCarpark, eventHandlers, onDestinationDrag, userLocation,
  drivePolyline, driveRoute, walkPolyline, walkRoute, startCoords, sidebarOpen,
}: Props) {
  const [tileId, setTileId] = useState(DEFAULT_TILE);
  const [buildings3D, setBuildings3D] = useState(false);
  const tile = getTileProvider(tileId) ?? getTileProvider(DEFAULT_TILE)!;

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[1.3521, 103.8198]} zoom={12} className="h-full w-full z-0"
        zoomSnap={1} zoomDelta={1} wheelPxPerZoomLevel={120} zoomAnimation={true}
        doubleClickZoom={false}
        zoomControl={false} minZoom={11} maxZoom={19}
        maxBounds={new LatLngBounds([1.15, 103.59], [1.47, 104.12])} maxBoundsViscosity={1.0}
      >
        <MapResizer sidebarOpen={sidebarOpen} />
        <ZoomControl position="bottomright" />
        <TileLayer key={tile.id} url={tile.url} attribution={tile.attribution}
          maxZoom={tile.maxZoom} subdomains={tile.subdomains ?? []}
          tileSize={tile.tileSize ?? 256} zoomOffset={tile.zoomOffset ?? 0} />

        <CameraFlyer selectedId={selectedId} results={carparks} hasSearched={hasSearched}
          destinationPoint={destinationPoint} userLocation={userLocation} />

        <SingaporeBoundary />
        {buildings3D && <OSMBuildingLayer />}
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

        {carparks.length > 0 && (
          <MarkerCluster carparks={carparks} selectedId={selectedId} onSelect={onSelectCarpark} hasSearched={hasSearched} />
        )}

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

        {drivePolyline && driveRoute && drivePolyline.length > 1 && (
          <RouteLabel position={midpoint(drivePolyline)} route={driveRoute} type="drive" />
        )}

        {walkPolyline && walkRoute && walkPolyline.length > 1 && (
          <RouteLabel position={midpoint(walkPolyline)} route={walkRoute} type="walk" />
        )}
      </MapContainer>

      <TileLayerSwitcher currentTile={tileId} onTileChange={setTileId}
        buildings3D={buildings3D} onToggleBuildings={() => setBuildings3D(v => !v)} sidebarOpen={false} />

      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-3 py-2.5">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Availability</p>
        {[
          ['#22c55e', 'High (>30%)'],
          ['#f59e0b', 'Low (10-30%)'],
          ['#ef4444', 'Very Low (<10%)'],
          ['#3b82f6', 'Available (no capacity)'],
          ['#9ca3af', 'No Data'],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-2 py-0.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[10px] font-bold text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
