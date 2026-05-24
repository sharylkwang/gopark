import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Carpark } from '../../types';

const SELECTED_ICON = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background-color:#dc2626;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:2px 2px 5px rgba(0,0,0,0.4)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -32],
});

const DEFAULT_ICON = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background-color:#3b82f6;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:2px 2px 5px rgba(0,0,0,0.4)"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -32],
});

interface Props {
  carpark: Carpark;
  isSelected: boolean;
  onSelect: (id: number) => void;
  markerRef?: (ref: L.Marker | null) => void;
}

export function CarparkMarker({ carpark, isSelected, onSelect, markerRef }: Props) {
  return (
    <Marker
      position={[carpark.lat, carpark.lng]}
      icon={isSelected ? SELECTED_ICON : DEFAULT_ICON}
      ref={markerRef}
      eventHandlers={{ click: () => onSelect(carpark.id) }}
    >
      <Popup>
        <div className="w-56 font-sans">
          <h3 className="font-black text-lg text-gray-900 border-b-2 border-red-600 pb-1 mb-2">
            {carpark.name}
          </h3>
          <p>
            <span className="font-bold">Weekday:</span> {carpark.weekday}
          </p>
          <p>
            <span className="font-bold">Weekend:</span> {carpark.weekend}
          </p>
          <div className="bg-gray-50 p-2 rounded-md border border-gray-200 mt-3">
            <p className="text-xs text-gray-500 font-bold uppercase mb-1">Est. Total</p>
            <p className="text-2xl font-black text-red-600">${carpark.price.toFixed(2)}</p>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
