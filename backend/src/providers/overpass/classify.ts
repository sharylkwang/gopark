import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('overpass');

const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const MIRROR_TIMEOUT_MS = 12000;

async function overpassQuery(query: string): Promise<any> {
  let lastError: unknown = null;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const { data } = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'GoPark/1.0',
        },
        timeout: MIRROR_TIMEOUT_MS,
      });

      if (data && Array.isArray(data.elements)) return data;
      lastError = new Error(`${mirror} returned a non-JSON response`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error('All Overpass mirrors unreachable');
}

const classifyCache = new Map<string, { data: PlaceClassification | null; ts: number }>();
const parkingCache = new Map<string, { data: NearbyParking[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;
const CLASSIFY_RADIUS_M = 150;
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
  doctors: ['Clinic', true, 'Building parking likely'],
  school: ['School', true, 'Visitor parking may be limited'],
  university: ['University', true, 'Campus parking available'],
  college: ['Education', true, 'Visitor parking may be limited'],
  place_of_worship: ['Place of Worship', true, 'May have limited parking'],
  marketplace: ['Market / Food Court', false, 'Nearby HDB parking'],
  food_court: ['Market / Food Court', false, 'Nearby HDB parking'],
  cinema: ['Cinema', true, 'Mall parking available'],
  theatre: ['Theatre', true, 'Venue parking available'],
  library: ['Library', true, 'Visitor parking available'],
  community_centre: ['Community Centre', true, 'Visitor parking available'],
  townhall: ['Civic Building', true, 'Visitor parking available'],
  courthouse: ['Civic Building', true, 'Visitor parking available'],
  police: ['Police Station', true, 'Visitor parking available'],
  bus_station: ['Bus Interchange', true, 'Interchange parking nearby'],
  ferry_terminal: ['Ferry Terminal', true, 'Terminal parking available'],
  exhibition_centre: ['Convention Centre', true, 'Venue parking available'],
  conference_centre: ['Convention Centre', true, 'Venue parking available'],
};

const VENUE_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'office', 'healthcare', 'aeroway'];

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

  if (tags['aeroway'] === 'terminal' || building === 'terminal')
    return { type: 'Airport Terminal', hasParking: true, parkingHint: 'Terminal carpark available' };

  if (tags['healthcare'] === 'hospital' || building === 'hospital')
    return toResult(AMENITY_TYPES['hospital']);

  if (AMENITY_TYPES[amenity]) return toResult(AMENITY_TYPES[amenity]);

  if (tags['tourism'] === 'hotel' || building === 'hotel')
    return toResult(BUILDING_TYPES['hotel']);

  if (shop === 'supermarket' || shop === 'mall' || shop === 'department_store' || building === 'mall')
    return { type: 'Shopping', hasParking: true, parkingHint: 'Store / mall parking available' };

  if (tags['office']) return toResult(BUILDING_TYPES['office']);

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

const OVERRIDE_RADIUS_M = 80;

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function elementDistance(el: any, lat: number, lng: number): number {
  const elLat = el?.lat ?? el?.center?.lat;
  const elLng = el?.lon ?? el?.center?.lon;
  if (typeof elLat !== 'number' || typeof elLng !== 'number') return Infinity;
  return distanceM(lat, lng, elLat, elLng);
}

function elementScore(el: any, lat?: number, lng?: number): number {
  const tags = el?.tags ?? {};
  let score = 0;

  if (el?.type === 'area') score += 50;

  if (VENUE_KEYS.some(key => tags[key])) score += 30;

  const building = tags['building'];
  if (building && building !== 'yes') score += 20;
  else if (building) score += 5;

  if (tags['landuse']) score += 2;
  if (tags['name']) score += 3;

  if (lat !== undefined && lng !== undefined && el?.type !== 'area') {
    const d = elementDistance(el, lat, lng);
    if (Number.isFinite(d)) score -= Math.min(d / 20, 12);
  }

  return score;
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
    [out:json][timeout:25];
    (
      nwr(around:${radius},${lat},${lng})["amenity"="parking"];
      nwr(around:${radius},${lat},${lng})["parking"];
      nwr(around:${radius},${lat},${lng})["amenity"="parking_entrance"];
    );
    out center tags;
  `;

  try {
    const data = await overpassQuery(query);

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
        : parking === 'parking_entrance' ? 'Carpark Entrance'
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

  const containing = `
    [out:json][timeout:25];
    is_in(${lat},${lng})->.here;
    (
      area.here["building"];
      area.here["amenity"];
      area.here["shop"];
      area.here["tourism"];
      area.here["leisure"];
      area.here["office"];
      area.here["healthcare"];
      area.here["aeroway"];
      area.here["landuse"];
    );
    out tags;
  `;

  const nearby = `
    [out:json][timeout:25];
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

  const pick = (elements: any[]): { result: PlaceClassification; strong: boolean; distance: number } | null => {
    elements.sort((a, b) => elementScore(b, lat, lng) - elementScore(a, lat, lng));
    for (const el of elements) {
      const tags = el.tags || {};
      const result = classifyTags(tags);
      if (!result) continue;

      const isVenue = VENUE_KEYS.some(key => tags[key]) || (tags['building'] && tags['building'] !== 'yes');
      return { result, strong: !!isVenue, distance: elementDistance(el, lat, lng) };
    }
    return null;
  };

  try {
    const enclosing = pick((await overpassQuery(containing)).elements ?? []);
    let best = enclosing;

    if (!enclosing?.strong) {
      const around = pick((await overpassQuery(nearby)).elements ?? []);
      const closeEnough = around?.strong && around.distance <= OVERRIDE_RADIUS_M;
      if (closeEnough || !enclosing) best = around ?? enclosing;
    }

    const result = best?.result ?? null;
    classifyCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    log.warn(`overpass classify failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
