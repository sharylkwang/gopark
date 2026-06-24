import axios from 'axios';
import createLogger from '../../lib/logger.js';

const log = createLogger('overpass');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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

export async function classifyPlace(lat: number, lng: number): Promise<PlaceClassification | null> {
  const query = `
    [out:json][timeout:10];
    (
      way(around:50,${lat},${lng})["building"];
      relation(around:50,${lat},${lng})["building"];
      way(around:50,${lat},${lng})["landuse"];
      node(around:50,${lat},${lng})["amenity"];
      way(around:50,${lat},${lng})["amenity"];
      node(around:50,${lat},${lng})["shop"];
      way(around:50,${lat},${lng})["leisure"];
      way(around:50,${lat},${lng})["tourism"];
    );
    out tags;
  `;

  try {
    const { data } = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    const elements = data?.elements ?? [];
    if (!elements.length) return null;

    elements.sort((a: any, b: any) => {
      const score = (e: any) => (e.tags?.name ? 2 : 0) + (e.tags?.building ? 1 : 0);
      return score(b) - score(a);
    });

    for (const el of elements) {
      const result = classifyTags(el.tags || {});
      if (result) return result;
    }

    return null;
  } catch (e) {
    log.warn(`overpass classify failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
