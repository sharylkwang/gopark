export interface Carpark {
  id: number;
  name: string;
  price: number;
  walkTime: number;
  lots: number;
  type: string;
  lat: number;
  lng: number;
  weekday: string;
  weekend: string;
}

export interface DestinationPoint {
  name: string;
  formatted: string;
  lat: number;
  lng: number;
}

export interface GeocodeResponse {
  name: string;
  formatted: string;
  lat: number;
  lon: number;
}

export type AppState = 'login' | 'user' | 'guest';
