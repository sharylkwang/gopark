import onemapClient from '../../lib/onemapClient.js';

interface LatLng {
  lat: number;
  lng: number;
}

export interface OnemapRouteResponse {
  distanceMeters: number;
  duration: string;
  polyline: string;
  travelMode: 'WALK' | 'BFA';
  trafficCondition: string;
  speedIntervals: never[];
}

async function fetchRoute(path: string, params: Record<string, string>, travelMode: 'WALK' | 'BFA', missing: string): Promise<OnemapRouteResponse> {
  const { data } = await onemapClient.get(path, { params });
  if (data.status !== 0 || !data.route_geometry) throw new Error(data.status_message || missing);
  return {
    distanceMeters: data.route_summary.total_distance,
    duration: `${data.route_summary.total_time}s`,
    polyline: data.route_geometry,
    travelMode,
    trafficCondition: 'NORMAL',
    speedIntervals: [],
  };
}

export function computeWalkRoute(origin: LatLng, destination: LatLng): Promise<OnemapRouteResponse> {
  return fetchRoute('/routingsvc/route', { start: `${origin.lat},${origin.lng}`, end: `${destination.lat},${destination.lng}`, routeType: 'walk' }, 'WALK', 'No walking route found');
}

export async function computeBfaRoute(origin: LatLng, destination: LatLng): Promise<OnemapRouteResponse> {
  try {
    return await fetchRoute('/bfa/routingsvc/route', { start: `${origin.lat},${origin.lng}`, end: `${destination.lat},${destination.lng}` }, 'BFA', 'No barrier-free route found');
  } catch (err: any) {
    if (err.response?.status === 403) throw new Error('BFA API access not authorized');
    if (err.response?.status === 404) throw new Error('Location outside BFA coverage area');
    throw err;
  }
}
