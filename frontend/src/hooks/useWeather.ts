import { useState, useEffect, useRef, useCallback } from 'react';
import { getWeatherByIP, getWeatherForCoords, getEmojiForWeather } from '../providers/govsg';

export function useWeather() {
  const [weather, setWeather] = useState('Loading...');
  const [temp, setTemp] = useState<number | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const refresh = useCallback(() => {
    if (coordsRef.current) {
      getWeatherForCoords(coordsRef.current.lat, coordsRef.current.lng)
        .then(r => { setWeather(r.forecast); setTemp(r.temp); })
        .catch(() => {});
    } else {
      getWeatherByIP()
        .then(r => { setWeather(r.forecast); setTemp(r.temp); })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 120000);
    return () => clearInterval(interval);
  }, [refresh]);

  const updateForCoords = (lat: number, lng: number) => {
    coordsRef.current = { lat, lng };
    getWeatherForCoords(lat, lng).then(r => { setWeather(r.forecast); setTemp(r.temp); });
  };

  const emoji = getEmojiForWeather(weather);

  return { weather, temp, emoji, updateForCoords };
}
