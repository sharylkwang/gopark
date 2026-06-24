import { useState, useEffect } from 'react';
import { getWeatherByIP, getWeatherForCoords, getIconForWeather } from '../providers/govsg';

export function useWeather() {
  const [weather, setWeather] = useState('Loading...');

  useEffect(() => {
    getWeatherByIP().then(({ forecast }) => setWeather(forecast));
  }, []);

  const updateForCoords = (lat: number, lng: number) => {
    getWeatherForCoords(lat, lng).then(setWeather);
  };

  return { weather, WeatherIcon: getIconForWeather(weather), updateForCoords };
}
