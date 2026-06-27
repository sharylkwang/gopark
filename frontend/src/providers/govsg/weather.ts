
const stripDayNight = (forecast: string) => forecast.replace(/\s*\((day|night)\)/i, '').trim();

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.sqrt(a);
};

async function fetchForecast(): Promise<any> {
  const res = await fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast');
  return res.json();
}

async function fetchTemperature(): Promise<any> {
  const res = await fetch('https://api.data.gov.sg/v1/environment/air-temperature');
  return res.json();
}

function findClosestTemp(data: any, lat: number, lng: number): number | null {
  if (!data?.metadata?.stations?.length || !data?.items?.[0]?.readings?.length) return null;
  let minDist = Infinity;
  let stationId = '';
  for (const st of data.metadata.stations) {
    const dist = getDistance(lat, lng, st.location.latitude, st.location.longitude);
    if (dist < minDist) { minDist = dist; stationId = st.id; }
  }
  const reading = data.items[0].readings.find((r: any) => r.station_id === stationId);
  return reading ? Math.round(reading.value) : null;
}

function findClosestForecast(data: any, lat: number, lng: number): string {
  let closestArea = data.area_metadata[0].name;
  let minDistance = Infinity;

  data.area_metadata.forEach((area: any) => {
    const dist = getDistance(lat, lng, area.label_location.latitude, area.label_location.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestArea = area.name;
    }
  });
  const forecastObj = data.items[0].forecasts.find((f: any) => f.area === closestArea);
  return forecastObj ? stripDayNight(forecastObj.forecast) : 'Fair';
}

export async function getWeatherForCoords(lat: number, lng: number): Promise<{ forecast: string; temp: number | null }> {
  try {
    const [forecastData, tempData] = await Promise.all([fetchForecast(), fetchTemperature().catch(() => null)]);
    const forecast = findClosestForecast(forecastData, lat, lng);
    const temp = tempData ? findClosestTemp(tempData, lat, lng) : null;
    return { forecast, temp };
  } catch {
    return { forecast: 'Fair', temp: null };
  }
}

export async function getWeatherByIP(): Promise<{ forecast: string; temp: number | null; lat: number; lng: number }> {
  const lat = 1.3521;
  const lng = 103.8198;
  try {
    const [forecastData, tempData] = await Promise.all([fetchForecast(), fetchTemperature().catch(() => null)]);
    const forecast = findClosestForecast(forecastData, lat, lng);
    const temp = tempData ? findClosestTemp(tempData, lat, lng) : null;
    return { forecast, temp, lat, lng };
  } catch {
    return { forecast: 'Fair', temp: null, lat, lng };
  }
}

export const getEmojiForWeather = (forecast: string): string => {
  const f = forecast.toLowerCase();
  if (f.includes('thundery')) return '⛈️';
  if (f.includes('heavy rain')) return '🌧️';
  if (f.includes('rain') || f.includes('shower')) return '🌦️';
  if (f.includes('partly cloudy')) return '⛅';
  if (f.includes('cloud') || f.includes('overcast')) return '☁️';
  if (f.includes('haz') || f.includes('fog')) return '🌫️';
  if (f.includes('wind')) return '💨';
  return '☀️';
};
