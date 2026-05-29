import axios from 'axios';
import type { CarparkRecord, AvailabilityEntry } from '../pipeline/types.js';
import { PARKAHOLIC, TIMEOUTS } from '../config.js';

const LOC_URL = 'https://parkaholic.sg/data.json';
const DUMP_URL = 'https://parkaholic.sg/api/dump';
const RATE_URL = 'https://parkaholic.sg/api/history';

export async function fetchLocations(): Promise<CarparkRecord[]> {
  const { data } = await axios.get(LOC_URL, { timeout: TIMEOUTS.api });
  const out: CarparkRecord[] = [];

  for (const [id, info] of Object.entries(data as Record<string, Record<string, unknown>>)) {
    const parts = ((info.Location as string) ?? '').split(' ');
    if (parts.length !== 2) continue;
    const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng) || lat < 1.15 || lat > 1.47 || lng < 103.59 || lng > 104.12) continue;

    const lots = (info.LotType as string[]) ?? [];
    out.push({
      id, name: (info.Development as string) ?? id, lat, lng, address: '', agency: '',
      source: 'parkaholic', rates: [], availability: {}, lot_types: lots.join(', '),
      metadata: { area: (info.Area as string) ?? '', lot_type_list: lots },
    });
  }
  return out;
}

export async function fetchDump(): Promise<Record<string, { availability: Record<string, AvailabilityEntry>; agency: string }>> {
  const { data } = await axios.get(DUMP_URL, { timeout: TIMEOUTS.api });
  const out: Record<string, { availability: Record<string, AvailabilityEntry>; agency: string }> = {};

  for (const info of Object.values((data.resp ?? {}) as Record<string, Record<string, unknown>>)) {
    const id = info.CarParkID as string;
    const lt = ['C', 'Y', 'H', 'S'].includes(info.LotType as string) ? (info.LotType as string) : 'C';
    const avail = info.AvailableLots != null ? parseInt(String(info.AvailableLots)) : null;
    const total = info.TotalLots != null ? parseInt(String(info.TotalLots)) : null;
    if (!out[id]) out[id] = { availability: {}, agency: (info.Agency as string) ?? '' };
    out[id].availability[lt] = { available: avail, total };
  }
  return out;
}

export async function fetchRates(ids: string[], concurrency = PARKAHOLIC.rateConcurrency): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(async id => {
      const { data } = await axios.post(RATE_URL, { CarParkID: id }, {
        headers: { 'content-type': 'application/json', origin: 'https://parkaholic.sg' },
        timeout: TIMEOUTS.parkaholicRate,
      });
      const r = data.resp ?? {};
      return { id, rates: { weekday: r.weekdays_rate_1 ?? '', weekday_2: r.weekdays_rate_2 ?? '', saturday: r.saturday_rate ?? '', sunday: r.sunday_publicholiday_rate ?? '', remarks: r.special_remarks ?? '' } };
    }));
    for (const r of results) {
      if (r.status === 'fulfilled' && Object.values(r.value.rates).some(Boolean)) out[r.value.id] = r.value.rates;
    }
  }
  return out;
}
