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

export async function computeWalkRoute(origin: LatLng, destination: LatLng): Promise<OnemapRouteResponse> {
  const response = await onemapClient.get('/routingsvc/route', {
    params: {
      start: `${origin.lat},${origin.lng}`,
      end: `${destination.lat},${destination.lng}`,
      routeType: 'walk',
    },
  });

  const data = response.data;

  if (data.status !== 0 || !data.route_geometry) {
    throw new Error(data.status_message || 'No walking route found');
  }

  return {
    distanceMeters: data.route_summary.total_distance,
    duration: `${data.route_summary.total_time}s`,
    polyline: data.route_geometry,
    travelMode: 'WALK',
    trafficCondition: 'NORMAL',
    speedIntervals: [],
  };
}

export async function computeBfaRoute(origin: LatLng, destination: LatLng): Promise<OnemapRouteResponse> {
  let response;
  try {
    response = await onemapClient.get('/bfa/routingsvc/route', {
      params: {
        start: `${origin.lat},${origin.lng}`,
        end: `${destination.lat},${destination.lng}`,
      },
    });
  } catch (err: any) {
    if (err.response?.status === 403) throw new Error('BFA API access not authorized');
    if (err.response?.status === 404) throw new Error('Location outside BFA coverage area');
    throw err;
  }

  const data = response.data;

  if (data.status !== 0 || !data.route_geometry) {
    throw new Error(data.status_message || 'No barrier-free route found');
  }

  return {
    distanceMeters: data.route_summary.total_distance,
    duration: `${data.route_summary.total_time}s`,
    polyline: data.route_geometry,
    travelMode: 'BFA',
    trafficCondition: 'NORMAL',
    speedIntervals: [],
  };
}
