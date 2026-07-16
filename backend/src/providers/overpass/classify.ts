import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('overpass');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const classifyCache = new Map<string, { data: PlaceClassification | null; ts: number }>();
const parkingCache = new Map<string, { data: NearbyParking[]; ts: number }>();
const ttl = 10 * 60 * 1000, R = 80;

interface PlaceClassification {
  type: string;
  hasParking: boolean;
  parkingHint: string;
}

const BUILDINGS: Record<string, PlaceClassification> = {
  apartments: { type: 'HDB / Apartment', hasParking: true, parkingHint: 'HDB parking nearby' },
  residential: { type: 'Residential', hasParking: true, parkingHint: 'May have visitor lots' },
  house: { type: 'Landed Property', hasParking: false, parkingHint: 'Street parking nearby' },
  detached: { type: 'Landed / Detached', hasParking: false, parkingHint: 'Street parking nearby' },
  bungalow: { type: 'Landed / Bungalow', hasParking: false, parkingHint: 'Street parking nearby' },
  terrace: { type: 'Landed / Terrace', hasParking: false, parkingHint: 'Street parking nearby' },
  semidetached_house: { type: 'Landed / Semi-D', hasParking: false, parkingHint: 'Street parking nearby' },
  commercial: { type: 'Commercial', hasParking: true, parkingHint: 'Building carpark available' },
  office: { type: 'Office Building', hasParking: true, parkingHint: 'Building carpark available' },
  retail: { type: 'Retail', hasParking: true, parkingHint: 'Building parking available' },
  industrial: { type: 'Industrial', hasParking: true, parkingHint: 'usually has its own carpark' },
  warehouse: { type: 'Warehouse', hasParking: true, parkingHint: 'usually has its own carpark' },
  hotel: { type: 'Hotel', hasParking: true, parkingHint: 'Hotel parking available' },
};

const AMENITIES: Record<string, PlaceClassification> = {
  hospital: { type: 'Hospital', hasParking: true, parkingHint: 'Hospital carpark available' },
  clinic: { type: 'Clinic', hasParking: true, parkingHint: 'Building parking likely' },
  school: { type: 'School', hasParking: true, parkingHint: 'visitor lots can be tight' },
  university: { type: 'University', hasParking: true, parkingHint: 'Campus parking available' },
  college: { type: 'Education', hasParking: true, parkingHint: 'visitor lots can be tight' },
  place_of_worship: { type: 'Place of Worship', hasParking: true, parkingHint: 'parking can be limited' },
  marketplace: { type: 'Market / Food Court', hasParking: false, parkingHint: 'Nearby HDB parking' },
  food_court: { type: 'Market / Food Court', hasParking: false, parkingHint: 'Nearby HDB parking' },
};

function classifyTags(tags: Record<string, string>): PlaceClassification | null {
  const building = tags['building'] || '', landuse = tags['landuse'] || '', amenity = tags['amenity'] || '';
  const shop = tags['shop'] || '', leisure = tags['leisure'] || '';

  if (tags['parking']) return { type: 'Parking', hasParking: true, parkingHint: 'This is a carpark' };

  if (building === 'apartments' || building === 'residential' || tags['residential'] === 'condominium') {
    const name = (tags['name'] || '').toLowerCase();
    const isCondo = name.includes('condo') || name.includes('residence') || name.includes('tower') || name.includes('heights') || tags['residential'] === 'condominium';
    return isCondo
      ? { type: 'Condominium', hasParking: true, parkingHint: 'Likely has visitor parking' }
      : BUILDINGS['apartments'];
  }

  if (BUILDINGS[building] && ['house', 'detached', 'bungalow', 'terrace', 'semidetached_house'].includes(building))
    return BUILDINGS[building];

  if (landuse === 'residential') return { type: 'Residential Area', hasParking: true, parkingHint: 'HDB / street parking nearby' };

  if (AMENITIES[amenity]) return AMENITIES[amenity];

  if (tags['tourism'] === 'hotel' || building === 'hotel') return BUILDINGS['hotel'];

  if (shop === 'supermarket' || shop === 'mall' || shop === 'department_store')
    return { type: 'Shopping', hasParking: true, parkingHint: 'Store / mall parking available' };

  if (BUILDINGS[building]) return BUILDINGS[building];
  if (landuse === 'commercial') return BUILDINGS['commercial'];
  if (landuse === 'industrial') return BUILDINGS['industrial'];

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

export async function findNearbyParking(lat: number, lng: number, radius = 500): Promise<NearbyParking[]> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
  const cached = parkingCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;

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
      const elLat = el.lat ?? el.center?.lat, elLng = el.lon ?? el.center?.lon;
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
    log.warn(`nearby parking lookup failed: ${String(e)}`);
    return [];
  }
}

export async function classifyPlace(lat: number, lng: number): Promise<PlaceClassification | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = classifyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;

  const query = `
    [out:json][timeout:10];
    (
      nwr(around:${R},${lat},${lng})["building"];
      nwr(around:${R},${lat},${lng})["landuse"];
      nwr(around:${R},${lat},${lng})["amenity"];
      nwr(around:${R},${lat},${lng})["shop"];
      nwr(around:${R},${lat},${lng})["leisure"];
      nwr(around:${R},${lat},${lng})["tourism"];
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
    log.warn(`classify query failed: ${String(e)}`);
    return null;
  }
}
