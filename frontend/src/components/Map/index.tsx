import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { CameraFlyer } from './CameraFlyer';
import { EventHandler } from './EventHandler';
import { CarparkMarker } from './CarparkMarker';
import { OSMBuildingLayer } from './layers/OSMBuildingLayer';
import { TileLayerSwitcher } from './TileLayerSwitcher';
import { getTileProvider, DEFAULT_TILE } from '../../config/tiles';
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
}: Props) {
  const [tileId, setTileId] = useState(DEFAULT_TILE);
  const tile = getTileProvider(tileId) ?? getTileProvider(DEFAULT_TILE)!;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[1.3521, 103.8198]}
        zoom={11}
        className="h-full w-full z-0"
        zoomSnap={0}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={60}
        zoomAnimation={true}
      >
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

        {tileId === 'osm' && <OSMBuildingLayer />}

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

      <TileLayerSwitcher currentTile={tileId} onTileChange={setTileId} />
    </div>
  );
}
