import { useEffect, useRef, useState } from 'react';

const STREAM = '/api/pricing/ticks';
const FALLBACK_MS = 60000;

export type TickSource = 'live' | 'local';

export function usePricingTick(onTick: (now: Date) => void): TickSource {
  const cbRef = useRef(onTick);
  cbRef.current = onTick;
  const [source, setSource] = useState<TickSource>('local');

  useEffect(() => {
    let es: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const startFallback = () => {
      if (fallback || closed) return;
      setSource('local');
      fallback = setInterval(() => cbRef.current(new Date()), FALLBACK_MS);
    };
    const stopFallback = () => {
      if (fallback) clearInterval(fallback);
      fallback = null;
    };

    try {
      es = new EventSource(STREAM);
      es.addEventListener('tick', event => {
        stopFallback();
        setSource('live');
        try {
          const { now } = JSON.parse((event as MessageEvent).data);
          cbRef.current(now ? new Date(now) : new Date());
        } catch {
          cbRef.current(new Date());
        }
      });
      es.onerror = () => startFallback();
    } catch {
      startFallback();
    }

    return () => {
      closed = true;
      es?.close();
      stopFallback();
    };
  }, []);

  return source;
}
