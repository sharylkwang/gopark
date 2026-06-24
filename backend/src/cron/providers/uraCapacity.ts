import axios from 'axios';
import createLogger from '../../lib/logger.js';
import type { AvailabilityEntry } from '../pipeline/types.js';

const log = createLogger('ura-capacity');

const DATASET_ID = 'd_9bf8620ecfdc8a5f8f77e3f02160af5c';

interface UraPlace {
  ppCode: string;
  name: string;
  lat: number;
  lng: number;
  cars: number;
  motorcycles: number;
  heavyVehicles: number;
}

export async function fetchUraCapacity(): Promise<Record<string, { cars: number; motorcycles: number; heavyVehicles: number; lat: number; lng: number; name: string }>> {
  const meta = await axios.get(`https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}/poll-download`, { timeout: 30000 });
  const downloadUrl = meta.data?.data?.url;
  if (!downloadUrl) throw new Error('URA capacity download URL not available');

  const { data: geojson } = await axios.get(downloadUrl, { timeout: 60000 });
  const features = geojson?.features ?? [];

  const places: Record<string, { cars: number; motorcycles: number; heavyVehicles: number; lat: number; lng: number; name: string }> = {};

  for (const f of features) {
    const props = f.properties ?? {};
    const ppCode = props.PP_CODE ?? '';
    if (!ppCode) continue;

    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    places[ppCode] = {
      cars: Number(props.NO_CAR) || 0,
      motorcycles: Number(props.NO_MCYCLE) || 0,
      heavyVehicles: Number(props.NO_H_VEHIC) || 0,
      lng: coords[0],
      lat: coords[1],
      name: props.PARKING_PL ?? '',
    };
  }

  log.info(`fetched capacity for ${Object.keys(places).length} URA parking places`);
  return places;
}
