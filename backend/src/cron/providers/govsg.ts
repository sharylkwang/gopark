import axios from 'axios';
import { svy21ToWgs84 } from 'svy21';
import type { CarparkRecord, AvailabilityEntry } from '../pipeline/types.js';
import { TIMEOUTS } from '../config.js';

const MAPPING = 'https://data.gov.sg/api/action/datastore_search';
const RESOURCE = 'd_23f946fa557947f93a8043bbef41dd09';
const AVAIL = 'https://api.data.gov.sg/v1/transport/carpark-availability';

export async function fetchMapping(): Promise<CarparkRecord[]> {
  const { data } = await axios.get(MAPPING, { params: { resource_id: RESOURCE, limit: 3000 }, timeout: TIMEOUTS.api });

  return data.result.records
    .map((row: Record<string, string>) => {
      const x = parseFloat(row.x_coord), y = parseFloat(row.y_coord);
      if (!x || !y || x <= 0 || y <= 0) return null;
      const [lat, lng] = svy21ToWgs84(y, x);
      return {
        id: row.car_park_no, name: row.address, lat, lng, address: row.address,
        agency: 'HDB', source: 'gov', rates: [], availability: {}, lot_types: '',
        metadata: {
          car_park_type: row.car_park_type ?? '', parking_system: row.type_of_parking_system ?? '',
          short_term: row.short_term_parking ?? '', free_parking: row.free_parking ?? '', night_parking: row.night_parking ?? '',
        },
      } as CarparkRecord;
    })
    .filter(Boolean) as CarparkRecord[];
}

export async function fetchAvailability(): Promise<Record<string, Record<string, AvailabilityEntry>>> {
  const headers = process.env.DATAGOVSG_KEY ? { 'x-api-key': process.env.DATAGOVSG_KEY } : {};
  const { data } = await axios.get(AVAIL, { headers, timeout: TIMEOUTS.api });

  const out: Record<string, Record<string, AvailabilityEntry>> = {};
  for (const cp of data.items[0].carpark_data) {
    const lots: Record<string, AvailabilityEntry> = {};
    for (const i of cp.carpark_info) {
      const total = parseInt(i.total_lots), avail = parseInt(i.lots_available);
      if (total > 0) lots[i.lot_type] = { available: avail, total };
    }
    if (Object.keys(lots).length) out[cp.carpark_number] = lots;
  }
  return out;
}
