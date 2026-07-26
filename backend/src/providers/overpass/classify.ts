import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('overpass');

const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function overpassQuery(query: string): Promise<any> {
  let lastErr: unknown = null;

  for (const mirror of MIRRORS) {
    try {
      const { data } = await axios.post(mirror, `data=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'GoPark/1.0',
        },
        timeout: 12000,
      });
      if (data && Array.isArray(data.elements)) return data;
      lastErr = new Error(`${mirror} gave non-json body`);
    } catch (e) { lastErr = e; }
  }

  throw lastErr ?? new Error('overpass mirrors all failed');
}

const classifyCache = new Map<string, { data: PlaceClassification | null; ts: number }>();
const parkingCache = new Map<string, { data: NearbyParking[]; ts: number }>();
const ttl = 10 * 60 * 1000, R = 150, OVERRIDE_M = 80;

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
  doctors: { type: 'Clinic', hasParking: true, parkingHint: 'Building parking likely' },
  school: { type: 'School', hasParking: true, parkingHint: 'visitor lots can be tight' },
  university: { type: 'University', hasParking: true, parkingHint: 'Campus parking available' },
  college: { type: 'Education', hasParking: true, parkingHint: 'visitor lots can be tight' },
  place_of_worship: { type: 'Place of Worship', hasParking: true, parkingHint: 'parking can be limited' },
  marketplace: { type: 'Market / Food Court', hasParking: false, parkingHint: 'Nearby HDB parking' },
  food_court: { type: 'Market / Food Court', hasParking: false, parkingHint: 'Nearby HDB parking' },
  cinema: { type: 'Cinema', hasParking: true, parkingHint: 'Mall parking available' },
  theatre: { type: 'Theatre', hasParking: true, parkingHint: 'Venue parking available' },
  library: { type: 'Library', hasParking: true, parkingHint: 'Visitor parking available' },
  community_centre: { type: 'Community Centre', hasParking: true, parkingHint: 'Visitor parking available' },
  townhall: { type: 'Civic Building', hasParking: true, parkingHint: 'Visitor parking available' },
  courthouse: { type: 'Civic Building', hasParking: true, parkingHint: 'Visitor parking available' },
  police: { type: 'Police Station', hasParking: true, parkingHint: 'Visitor parking available' },
  bus_station: { type: 'Bus Interchange', hasParking: true, parkingHint: 'Interchange parking nearby' },
  ferry_terminal: { type: 'Ferry Terminal', hasParking: true, parkingHint: 'Terminal parking available' },
  exhibition_centre: { type: 'Convention Centre', hasParking: true, parkingHint: 'Venue parking available' },
  conference_centre: { type: 'Convention Centre', hasParking: true, parkingHint: 'Venue parking available' },
};

const VENUE_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'office', 'healthcare', 'aeroway'];

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

  if (tags['aeroway'] === 'terminal' || building === 'terminal')
    return { type: 'Airport Terminal', hasParking: true, parkingHint: 'Terminal carpark available' };

  if (tags['healthcare'] === 'hospital' || building === 'hospital') return AMENITIES['hospital'];

  if (AMENITIES[amenity]) return AMENITIES[amenity];

  if (tags['tourism'] === 'hotel' || building === 'hotel') return BUILDINGS['hotel'];

  if (shop === 'supermarket' || shop === 'mall' || shop === 'department_store' || building === 'mall')
    return { type: 'Shopping', hasParking: true, parkingHint: 'Store / mall parking available' };

  if (tags['office']) return BUILDINGS['office'];

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

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function elementDistance(el: any, lat: number, lng: number): number {
  const elLat = el?.lat ?? el?.center?.lat, elLng = el?.lon ?? el?.center?.lon;
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

export async function findNearbyParking(lat: number, lng: number, radius = 500): Promise<NearbyParking[]> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
  const cached = parkingCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;

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
    log.warn(`nearby parking lookup failed: ${String(e)}`);
    return [];
  }
}

export async function classifyPlace(lat: number, lng: number): Promise<PlaceClassification | null> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = classifyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) return cached.data;

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
      nwr(around:${R},${lat},${lng})["building"];
      nwr(around:${R},${lat},${lng})["landuse"];
      nwr(around:${R},${lat},${lng})["amenity"];
      nwr(around:${R},${lat},${lng})["shop"];
      nwr(around:${R},${lat},${lng})["leisure"];
      nwr(around:${R},${lat},${lng})["tourism"];
    );
    out tags center;
  `;

  const pick = (elements: any[]) => {
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
      const closeEnough = around?.strong && around.distance <= OVERRIDE_M;
      if (closeEnough || !enclosing) best = around ?? enclosing;
    }

    const result = best?.result ?? null;
    classifyCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    log.warn(`classify query failed: ${String(e)}`);
    return null;
  }
}
