import gcpClient from '../../lib/gcpClient';

interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = 'DRIVE' | 'WALK' | 'BICYCLE';

export interface SpeedInterval {
  startPolylinePointIndex: number;
  endPolylinePointIndex: number;
  speed: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
}

export interface RouteResponse {
  distanceMeters: number;
  duration: string;
  polyline: string;
  travelMode: TravelMode;
  trafficCondition: string;
  speedIntervals: SpeedInterval[];
}

export async function computeRoute(origin: LatLng, destination: LatLng, mode: TravelMode = 'DRIVE'): Promise<RouteResponse> {
  const isDrive = mode === 'DRIVE';

  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: mode,
    computeAlternativeRoutes: false,
    languageCode: 'en-US',
    units: 'METRIC',
  };

  if (isDrive) {
    body.routingPreference = 'TRAFFIC_AWARE';
    body.extraComputations = ['TRAFFIC_ON_POLYLINE'];
  }

  const fieldMask = isDrive
    ? 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals'
    : 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

  const response = await gcpClient.post('/directions/v2:computeRoutes', body, {
    headers: { 'X-Goog-FieldMask': fieldMask },
  });

  const route = response.data.routes?.[0];
  if (!route) throw new Error('No route found');

  const intervals: SpeedInterval[] = isDrive
    ? (route.travelAdvisory?.speedReadingIntervals ?? []).map((s: any) => ({
        startPolylinePointIndex: s.startPolylinePointIndex ?? 0,
        endPolylinePointIndex: s.endPolylinePointIndex ?? 0,
        speed: s.speed ?? 'NORMAL',
      }))
    : [];

  let trafficCondition = 'NORMAL';
  if (intervals.length) {
    const slow = intervals.filter(s => s.speed === 'SLOW' || s.speed === 'TRAFFIC_JAM');
    if (slow.length > intervals.length * 0.3) trafficCondition = 'HEAVY';
    else if (slow.length > 0) trafficCondition = 'MODERATE';
  }

  return {
    distanceMeters: route.distanceMeters,
    duration: route.duration,
    polyline: route.polyline?.encodedPolyline || '',
    travelMode: mode,
    trafficCondition,
    speedIntervals: intervals,
  };
}
