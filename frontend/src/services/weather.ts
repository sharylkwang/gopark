import { Sun, CloudRain, CloudLightning, Cloud, CloudSun, Moon, CloudMoon } from 'lucide-react';

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return Math.sqrt(a);
};

export async function getWeatherForCoords(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast');
    const data = await res.json();

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
  } catch {
    return 'Fair';
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