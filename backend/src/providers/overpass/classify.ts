import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('overpass');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const classifyCache = new Map<string, { data: PlaceClassification | null; ts: number }>();
const parkingCache = new Map<string, { data: NearbyParking[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const CLASSIFY_RADIUS_M = 80;
const NEARBY_PARKING_RADIUS_M = 500;

interface PlaceClassification {
  type: string;
  hasParking: boolean;
  parkingHint: string;
}

const BUILDING_TYPES: Record<string, [string, boolean, string]> = {
  apartments: ['HDB / Apartment', true, 'HDB parking nearby'],
  residential: ['Residential', true, 'May have visitor lots'],
  house: ['Landed Property', false, 'Street parking nearby'],
  detached: ['Landed / Detached', false, 'Street parking nearby'],
  bungalow: ['Landed / Bungalow', false, 'Street parking nearby'],
  terrace: ['Landed / Terrace', false, 'Street parking nearby'],
  semidetached_house: ['Landed / Semi-D', false, 'Street parking nearby'],
  commercial: ['Commercial', true, 'Building carpark available'],
  office: ['Office Building', true, 'Building carpark available'],
  retail: ['Retail', true, 'Building parking available'],
  industrial: ['Industrial', true, 'On-site parking likely'],
  warehouse: ['Warehouse', true, 'On-site parking likely'],
  hotel: ['Hotel', true, 'Hotel parking available'],
};

const AMENITY_TYPES: Record<string, [string, boolean, string]> = {
  hospital: ['Hospital', true, 'Hospital carpark available'],
  clinic: ['Clinic', true, 'Building parking likely'],
  school: ['School', true, 'Visitor parking may be limited'],
  university: ['University', true, 'Campus parking available'],
  college: ['Education', true, 'Visitor parking may be limited'],
  place_of_worship: ['Place of Worship', true, 'May have limited parking'],
  marketplace: ['Market / Food Court', false, 'Nearby HDB parking'],
  food_court: ['Market / Food Court', false, 'Nearby HDB parking'],
};

function toResult(tuple: [string, boolean, string]): PlaceClassification {
  return { type: tuple[0], hasParking: tuple[1], parkingHint: tuple[2] };
}

function classifyTags(tags: Record<string, string>): PlaceClassification | null {
  const building = tags['building'] || '';
  const landuse = tags['landuse'] || '';
  const amenity = tags['amenity'] || '';
  const shop = tags['shop'] || '';
  const leisure = tags['leisure'] || '';

  if (tags['parking']) return { type: 'Parking', hasParking: true, parkingHint: 'This is a carpark' };

  if (building === 'apartments' || building === 'residential' || tags['residential'] === 'condominium') {
    const name = (tags['name'] || '').toLowerCase();
    const isCondo = name.includes('condo') || name.includes('residence') || name.includes('tower') || name.includes('heights') || tags['residential'] === 'condominium';
    return isCondo
      ? { type: 'Condominium', hasParking: true, parkingHint: 'Likely has visitor parking' }
      : toResult(BUILDING_TYPES['apartments']);
  }

  if (BUILDING_TYPES[building] && ['house', 'detached', 'bungalow', 'terrace', 'semidetached_house'].includes(building))
    return toResult(BUILDING_TYPES[building]);

  if (landuse === 'residential') return { type: 'Residential Area', hasParking: true, parkingHint: 'HDB / street parking nearby' };

  if (AMENITY_TYPES[amenity]) return toResult(AMENITY_TYPES[amenity]);

  if (tags['tourism'] === 'hotel' || building === 'hotel')
    return toResult(BUILDING_TYPES['hotel']);

  if (shop === 'supermarket' || shop === 'mall' || shop === 'department_store')
    return { type: 'Shopping', hasParking: true, parkingHint: 'Store / mall parking available' };

  if (BUILDING_TYPES[building]) return toResult(BUILDING_TYPES[building]);
  if (landuse === 'commercial') return toResult(BUILDING_TYPES['commercial']);
  if (landuse === 'industrial') return toResult(BUILDING_TYPES['industrial']);

  if (leisure === 'sports_centre' || leisure === 'stadium')
    return { type: 'Sports Complex', hasParking: true, parkingHint: 'Facility parking available' };

  if (leisure === 'park' || leisure === 'garden')
    return { type: 'Park', hasParking: false, parkingHint: 'Nearby street or HDB parking' };

  if (building && building !== 'yes') {
    const label = building.charAt(0).toUpperCase() + building.slice(1).replace(/_/g, ' ');
    return { type: label, hasParking: true, parkingHint: 'Building parking may be available' };
  }

  return null;
}

export interface NearbyParking {
  lat: number;
  lng: number;
  name: string | null;
  type: string;
  access: string | null;
  capacity: number | null;
}

export async function findNearbyParking(lat: number, lng: number, radius = NEARBY_PARKING_RADIUS_M): Promise<NearbyParking[]> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
  const cached = parkingCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const query = `
    [out:json][timeout:10];
    (
      node(around:${radius},${lat},${lng})["amenity"="parking"];
      way(around:${radius},${lat},${lng})["amenity"="parking"];
      node(around:${radius},${lat},${lng})["parking"];
      way(around:${radius},${lat},${lng})["parking"];
    );
    out center tags;
  `;

  try {
    const { data } = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'GoPark/1.0',
      },
      timeout: 8000,
    });

    const seen = new Set<string>();
    const results: NearbyParking[] = [];

    for (const el of data?.elements ?? []) {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) continue;

      const key = `${elLat.toFixed(5)},${elLng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const tags = el.tags || {};
      const parking = tags['parking'] || tags['amenity'];
      const pType = parking === 'multi-storey' ? 'Multi-Storey'
        : parking === 'underground' ? 'Underground'
        : parking === 'surface' ? 'Surface Lot'
        : parking === 'street_side' || parking === 'on_street' || parking === 'lane' ? 'Street Parking'
        : 'Carpark';

      const nameLC = (tags['name'] || '').toLowerCase();
      const isHdb = nameLC.includes('hdb') || nameLC.includes('blk ') || nameLC.includes('block ')
        || tags['operator']?.toLowerCase().includes('hdb')
        || tags['residential'] === 'HDB';
      if (isHdb) continue;

      results.push({
        lat: elLat,
        lng: elLng,
        name: tags['name'] || null,
        type: pType,
        access: tags['access'] || null,
        capacity: tags['capacity'] ? parseInt(tags['capacity'], 10) : null,
      });
    }

    parkingCache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  } catch (e) {
    log.warn(`overpass nearby parking failed: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

export async function classifyPlace(lat: number, lng: number): Promise<PlaceClassification | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = classifyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const query = `
    [out:json][timeout:10];
    (
      nwr(around:${CLASSIFY_RADIUS_M},${lat},${lng})["building"];
      nwr(around:${CLASSIFY_RADIUS_M},${lat},${lng})["landuse"];
      nwr(around:${CLASSIFY_RADIUS_M},${lat},${lng})["amenity"];
      nwr(around:${CLASSIFY_RADIUS_M},${lat},${lng})["shop"];
      nwr(around:${CLASSIFY_RADIUS_M},${lat},${lng})["leisure"];
      nwr(around:${CLASSIFY_RADIUS_M},${lat},${lng})["tourism"];
    );
    out tags center;
  `;

  try {
    const { data } = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'GoPark/1.0',
      },
      timeout: 8000,
    });

    const elements = data?.elements ?? [];
    if (!elements.length) return null;

    elements.sort((a: any, b: any) => {
      const score = (e: any) => (e.tags?.name ? 2 : 0) + (e.tags?.building ? 1 : 0);
      return score(b) - score(a);
    });

    for (const el of elements) {
      const result = classifyTags(el.tags || {});
      if (result) {
        classifyCache.set(cacheKey, { data: result, ts: Date.now() });
        return result;
      }
    }

    classifyCache.set(cacheKey, { data: null, ts: Date.now() });
    return null;
  } catch (e) {
    log.warn(`overpass classify failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
