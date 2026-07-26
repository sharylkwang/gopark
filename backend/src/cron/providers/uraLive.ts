import { fetchLiveLots, fetchCarparkDetails } from '../../providers/ura/service.js';
import { isUraConfigured } from '../../providers/ura/token.js';
import type { CarparkRecord, AvailabilityEntry } from '../pipeline/types.js';

const LOT_TYPES: Record<string, string> = { C: 'C', M: 'Y', H: 'H' };
const VEH_CATS: Record<string, string> = { Car: 'C', Motorcycle: 'Y', 'Heavy Vehicle': 'H' };

export interface UraLiveResult {
  records: CarparkRecord[];
  availability: Record<string, Record<string, AvailabilityEntry>>;
}

export function mapLotType(t: string): string {
  return LOT_TYPES[t] ?? 'C';
}

export async function fetchUraLive(): Promise<UraLiveResult> {
  if (!isUraConfigured()) return { records: [], availability: {} };

  const lots = await fetchLiveLots();
  const names: Record<string, string> = {};
  const capacities: Record<string, Record<string, number>> = {};
  try {
    for (const row of await fetchCarparkDetails()) {
      const code = String(row.ppCode ?? '').trim();
      if (!code) continue;
      const name = String(row.ppName ?? '').trim();
      if (name && !names[code]) names[code] = name;
      const vt = VEH_CATS[String(row.vehCat ?? '')];
      const cap = parseInt(String(row.parkCapacity ?? ''), 10);
      if (vt && cap > 0) (capacities[code] ??= {})[vt] = cap;
    }
  } catch {}

  const coords: Record<string, { lat: number; lng: number }> = {};
  const availability: Record<string, Record<string, AvailabilityEntry>> = {};
  for (const lot of lots) {
    const no = lot.carparkNo.trim();
    if (!no) continue;
    const lt = mapLotType(lot.lotType);
    coords[no] ??= { lat: lot.lat, lng: lot.lng };
    (availability[no] ??= {})[lt] = { available: lot.lotsAvailable, total: capacities[no]?.[lt] ?? null };
  }

  const records: CarparkRecord[] = Object.entries(coords).map(([no, c]) => ({
    id: `URA-${no}`, name: names[no] || `URA CAR PARK ${no}`, lat: c.lat, lng: c.lng,
    address: '', agency: 'URA', source: 'ura', rates: [],
    availability: availability[no] ?? {}, lot_types: '', metadata: {},
  }));

  return { records, availability };
}
