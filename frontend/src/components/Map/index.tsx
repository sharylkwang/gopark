import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import { CameraFlyer } from './CameraFlyer';
import { EventHandler } from './EventHandler';
import { CarparkMarker } from './CarparkMarker';
import { OSMBuildingLayer } from './layers/OSMBuildingLayer';
import { TileLayerSwitcher } from './TileLayerSwitcher';
import { getTileProvider, DEFAULT_TILE } from '../../providers/tiles';
import type { Carpark, DestinationPoint } from '../../types';
import type { MapEventHandlers } from '../../types/map';

interface Props {
  carparks: Carpark[];
  selectedId: number | null;
  destinationPoint: DestinationPoint | null;
  hasSearched: boolean;
  onSelectCarpark: (id: number) => void;
  markerRefs: React.MutableRefObject<Record<number, L.Marker>>;
  eventHandlers?: MapEventHandlers;
  userLocation?: [number, number] | null;
  sidebarOpen?: boolean;
}

export function MapView({
  carparks,
  selectedId,
  destinationPoint,
  hasSearched,
  onSelectCarpark,
  markerRefs,
  eventHandlers,
  userLocation,
  sidebarOpen = true,
}: Props) {
  const [tileId, setTileId] = useState(DEFAULT_TILE);
  const [buildings3D, setBuildings3D] = useState(false);
  const tile = getTileProvider(tileId) ?? getTileProvider(DEFAULT_TILE)!;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[1.2838, 103.8607]}
        zoom={16}
        className="h-full w-full z-0"
        zoomSnap={1}
        zoomDelta={1}
        wheelPxPerZoomLevel={120}
        zoomAnimation={true}
        zoomControl={false}
        minZoom={11}
        maxZoom={19}
        maxBounds={new LatLngBounds([1.15, 103.59], [1.47, 104.12])}
        maxBoundsViscosity={1.0}
      >
        <ZoomControl position="bottomright" />

        <TileLayer
          key={tile.id}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
          subdomains={tile.subdomains ?? []}
          tileSize={tile.tileSize ?? 256}
          zoomOffset={tile.zoomOffset ?? 0}
        />

        <CameraFlyer
          selectedId={selectedId}
          results={carparks}
          hasSearched={hasSearched}
          destinationPoint={destinationPoint}
        />

        {buildings3D && <OSMBuildingLayer />}

        {eventHandlers && <EventHandler {...eventHandlers} />}

        {destinationPoint && (
          <Marker position={[destinationPoint.lat, destinationPoint.lng]}>
            <Popup>
              <strong>{destinationPoint.name}</strong>
              <br />
              {destinationPoint.formatted}
            </Popup>
          </Marker>
        )}

        {userLocation && (
          <Marker 
            position={userLocation}
            icon={L.divIcon({
              className: 'user-marker',
              html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`
              })}
              >
            <Popup>
              You are here
            </Popup>
          </Marker>
        )}

        {hasSearched &&
          carparks.map((carpark) => (
            <CarparkMarker
              key={carpark.id}
              carpark={carpark}
              isSelected={selectedId === carpark.id}
              onSelect={onSelectCarpark}
              markerRef={(ref) => {
                if (ref) markerRefs.current[carpark.id] = ref;
              }}
            />
          ))}
      </MapContainer>

      <TileLayerSwitcher
        currentTile={tileId}
        onTileChange={setTileId}
        buildings3D={buildings3D}
        onToggleBuildings={() => setBuildings3D((v) => !v)}
        sidebarOpen={sidebarOpen}
      />
    </div>
  );
}
