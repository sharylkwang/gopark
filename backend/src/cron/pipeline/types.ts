export interface RateEntry {
  amount: number;
  duration_mins: number | null;
  unit: string;
  vehicle_type: string;
  period_start: string | null;
  period_end: string | null;
  is_first: boolean;
  day_type: string;
  source: string;
}

export interface AvailabilityEntry {
  available: number | null;
  total: number | null;
}

export interface CarparkRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  agency: string;
  source: string;
  rates: RateEntry[];
  availability: Record<string, AvailabilityEntry>;
  lot_types: string;
  metadata: Record<string, unknown>;
}

export interface MergedCarpark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  agency: string;
  sources: string[];
  source_ids: Record<string, string>;
  source_count: number;
  rates: (RateEntry & { sources: string[]; confirmed_by: number })[];
  availability: Record<string, AvailabilityEntry>;
  lot_types: string;
  metadata: Record<string, unknown>;
  last_updated: string;
}

export interface DatamallResult {
  records: CarparkRecord[];
  availability: Record<string, Record<string, AvailabilityEntry>>;
  agencies: Record<string, { agency: string; area: string; development: string }>;
}

export interface JustParkResult {
  records: CarparkRecord[];
  availability: Record<string, Record<string, AvailabilityEntry>>;
}

export interface ScrapedCarpark {
  name: string;
  address?: string;
  rates: {
    vehicle_type?: string;
    day_type?: string;
    rate_text?: string;
    amount_dollars?: number;
    per_minutes?: number | null;
    time_start?: string | null;
    time_end?: string | null;
    is_first_block?: boolean;
  }[];
}

export interface ScrapedResult {
  source: string;
  carparks: ScrapedCarpark[];
}
