import { Sun, CloudRain, CloudLightning, Cloud, CloudSun, Moon, CloudMoon } from 'lucide-react';

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
  return forecastObj ? forecastObj.forecast : 'Fair';
}

export async function getWeatherForCoords(lat: number, lng: number): Promise<string> {
  try {
    const data = await fetchForecast();
    return findClosestForecast(data, lat, lng);
  } catch {
    return 'Fair';
  }
}

export async function getWeatherByIP(): Promise<{ forecast: string; lat: number; lng: number }> {
  try {
    const ipRes = await fetch('https://ipapi.co/json/');
    const ipData = await ipRes.json();
    const lat = ipData.latitude ?? 1.2838;
    const lng = ipData.longitude ?? 103.8607;

    const data = await fetchForecast();
    return { forecast: findClosestForecast(data, lat, lng), lat, lng };
  } catch {
    const data = await fetchForecast().catch(() => null);
    if (data) {
      return { forecast: findClosestForecast(data, 1.2838, 103.8607), lat: 1.2838, lng: 103.8607 };
    }
    return { forecast: 'Fair', lat: 1.2838, lng: 103.8607 };
  }
}

export const getIconForWeather = (forecast: string) => {
  const f = forecast.toLowerCase();
  if (f.includes('rain') || f.includes('shower')) return CloudRain;
  if (f.includes('thundery')) return CloudLightning;
  if (f.includes('partly cloudy')) return f.includes('night') ? CloudMoon : CloudSun;
  if (f.includes('cloud')) return Cloud;
  if (f.includes('night')) return Moon;
  return Sun;
};
