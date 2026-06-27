import { useState, useEffect, useRef } from 'react';

export function useLocation() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationShared, setLocationShared] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
<<<<<<< HEAD
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
=======
    if (!navigator.geolocation) return;

    navigator.permissions?.query({ name: 'geolocation' }).then(status => {
      if (status.state === 'granted') {
        navigator.geolocation.getCurrentPosition(pos => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          setLocationShared(true);
        });
      }
      status.addEventListener('change', () => {
        if (status.state === 'granted') {
          navigator.geolocation.getCurrentPosition(pos => {
            setUserLocation([pos.coords.latitude, pos.coords.longitude]);
            setLocationShared(true);
          });
        } else if (status.state === 'denied') {
          setLocationShared(false);
        }
      });
    }).catch(() => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          setLocationShared(true);
        },
        () => {}
      );
    });
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node))
        setShowTooltip(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const shareLocation = (onCoords: (lat: number, lng: number) => void) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        setLocationShared(true);
        setShowTooltip(false);
        onCoords(coords[0], coords[1]);
      },
      () => setShowTooltip(false)
    );
  };

  return {
    userLocation, locationShared,
    showTooltip, setShowTooltip, tooltipRef,
    shareLocation,
  };
}
