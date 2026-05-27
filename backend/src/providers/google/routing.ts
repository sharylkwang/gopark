import axios from 'axios';

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteResponse {
  distanceMeters: number;
  duration: string;
  polyline: string;
  trafficCondition: string;
}

export async function computeRoute(origin: LatLng, destination: LatLng): Promise<RouteResponse> {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_KEY not configured');

  const response = await axios.post(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'METRIC',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory',
      },
      timeout: 10000,
    },
  );

  const route = response.data.routes?.[0];
  if (!route) throw new Error('No route found');

  const advisory = route.travelAdvisory?.speedReadingIntervals;
  let trafficCondition = 'NORMAL';
  if (advisory?.length) {
    const slow = advisory.filter((s: any) => s.speed === 'SLOW' || s.speed === 'TRAFFIC_JAM');
    if (slow.length > advisory.length * 0.3) trafficCondition = 'HEAVY';
    else if (slow.length > 0) trafficCondition = 'MODERATE';
  }

  return {
    distanceMeters: route.distanceMeters,
    duration: route.duration,
    polyline: route.polyline?.encodedPolyline || '',
    trafficCondition,
  };
}
