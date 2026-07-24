import axios from 'axios';
import createLogger from '../../lib/logger.js';
import { getAccessKey, getDailyToken, resetTokenCache } from './token.js';
import { svy21ToWgs84 } from './svy21.js';

const log = createLogger('ura-service');

const DATA_SERVICE_URL = 'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1';

export type UraServiceName =
  | 'Car_Park_Availability'
  | 'Car_Park_Details'
  | 'Season_Car_Park_Details';

const CACHE_TTL_MS: Record<UraServiceName, number> = {
  Car_Park_Availability: 3 * 60 * 1000,
  Car_Park_Details: 6 * 60 * 60 * 1000,
  Season_Car_Park_Details: 6 * 60 * 60 * 1000,
};

interface UraGeometry {
  coordinates?: string;
}

interface UraRow {
  geometries?: UraGeometry[];
  [key: string]: unknown;
}

const serviceCache = new Map<UraServiceName, { rows: UraRow[]; fetchedAt: number }>();

export function resetServiceCache(): void {
  serviceCache.clear();
}

function parseCoordinates(geometries: UraGeometry[] | undefined): { lat: number; lng: number }[] {
  if (!Array.isArray(geometries)) return [];
  const points: { lat: number; lng: number }[] = [];
  for (const geometry of geometries) {
    const parts = String(geometry?.coordinates ?? '')
      .split(',')
      .map((value) => parseFloat(value.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) continue;
    points.push(svy21ToWgs84(parts[0], parts[1]));
  }
  return points;
}

async function requestService(service: UraServiceName): Promise<UraRow[]> {
  const token = await getDailyToken();
  const { data } = await axios.get(DATA_SERVICE_URL, {
    params: { service },
    timeout: 30000,
    headers: { AccessKey: getAccessKey(), Token: token, 'User-Agent': 'GoPark/1.0' },
  });

  if (data?.Status !== 'Success' || !Array.isArray(data?.Result)) {
    resetTokenCache();
    throw new Error(data?.Message || `URA ${service} request failed`);
  }
  return data.Result;
}

async function fetchService(service: UraServiceName): Promise<UraRow[]> {
  const cached = serviceCache.get(service);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS[service]) return cached.rows;

  const rows = await requestService(service);
  serviceCache.set(service, { rows, fetchedAt: Date.now() });
  log.info(`fetched ${rows.length} rows from URA ${service}`);
  return rows;
}

export interface UraLiveLot {
  carparkNo: string;
  lotType: string;
  lotsAvailable: number;
  lat: number;
  lng: number;
}

export async function fetchLiveLots(): Promise<UraLiveLot[]> {
  const rows = await fetchService('Car_Park_Availability');
  const lots: UraLiveLot[] = [];
  for (const row of rows) {
    const points = parseCoordinates(row.geometries);
    if (points.length === 0) continue;
    lots.push({
      carparkNo: String(row.carparkNo ?? ''),
      lotType: String(row.lotType ?? ''),
      lotsAvailable: Number(row.lotsAvailable) || 0,
      lat: points[0].lat,
      lng: points[0].lng,
    });
  }
  return lots;
}

function withWgs84Locations(row: UraRow): Record<string, unknown> {
  const { geometries, ...rest } = row;
  return { ...rest, locations: parseCoordinates(geometries) };
}

export async function fetchCarparkDetails(): Promise<Record<string, unknown>[]> {
  const rows = await fetchService('Car_Park_Details');
  return rows.map(withWgs84Locations);
}

export async function fetchSeasonCarparks(): Promise<Record<string, unknown>[]> {
  const rows = await fetchService('Season_Car_Park_Details');
  return rows.map(withWgs84Locations);
}
