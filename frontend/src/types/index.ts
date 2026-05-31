export interface CarparkAvailability {
  available: number | null;
  total: number | null;
}

export interface CarparkSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  agency: string;
  sources: string[];
  lotTypes: string;
  availability: Record<string, CarparkAvailability>;
  distance?: number;
}

export interface CarparkRate {
  amount: number;
  durationMins: number | null;
  unit: string;
  vehicleType: string;
  periodStart: string | null;
  periodEnd: string | null;
  isFirst: boolean;
  dayType: string;
  sources: string[];
  confirmedBy: number;
}

export interface CarparkDetail extends CarparkSummary {
  metadata: Record<string, unknown>;
  detailsUpdatedAt: string;
  availabilityUpdatedAt: string;
  rates: CarparkRate[];
  availability: Record<string, CarparkAvailability & { updatedAt?: string }>;
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

export interface PlaceSuggestion {
  name?: string;
  formatted: string;
  lat: number;
  lon: number;
}

export type AppState = 'login' | 'user' | 'guest';
