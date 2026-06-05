import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
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

const getCustomPin = (color: string) => {
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 2px 2px 5px rgba(0,0,0,0.4);
      transition: all 0.2s ease;
    "></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32]
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
  userLocation?: [number, number] | null;
}

export function MapView({
  carparks, selectedId, destinationPoint, hasSearched,
  onSelectCarpark, eventHandlers, userLocation,
}: Props) {
  const [tileId, setTileId] = useState(DEFAULT_TILE);
  const [buildings3D, setBuildings3D] = useState(false);
  const tile = getTileProvider(tileId) ?? getTileProvider(DEFAULT_TILE)!;

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[1.3521, 103.8198]} zoom={12} className="h-full w-full z-0"
        zoomSnap={1} zoomDelta={1} wheelPxPerZoomLevel={120} zoomAnimation={true}
        zoomControl={false} minZoom={11} maxZoom={19}
        maxBounds={new LatLngBounds([1.15, 103.59], [1.47, 104.12])} maxBoundsViscosity={1.0}
      >
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
          <Marker 
            position={[destinationPoint.lat, destinationPoint.lng]}
            icon={getCustomPin('#16a34a')} 
          >
            <Popup><strong>{destinationPoint.name}</strong><br />{destinationPoint.formatted}</Popup>
          </Marker>
        )}

        {userLocation && (
          <Marker
            position={userLocation}
            icon={getUserDot()}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        {carparks.length > 0 && (
          <MarkerCluster 
            carparks={carparks} 
            selectedId={selectedId} 
            onSelect={onSelectCarpark} 
          />
        )}
      </MapContainer>

      <TileLayerSwitcher currentTile={tileId} onTileChange={setTileId}
        buildings3D={buildings3D} onToggleBuildings={() => setBuildings3D(v => !v)} sidebarOpen={false} />
    </div>
  );
}
