import { useEffect, useRef, useState } from 'react';
import { fetchAvailability } from '../providers/carparks';
import type { AvailabilityMap } from '../providers/carparks';

export type LiveState = 'connecting' | 'live' | 'polling';

export function useLiveAvailability(ids: string[], onUpdate: (carparks: AvailabilityMap) => void) {
  const [state, setState] = useState<LiveState>('connecting');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const key = ids.slice().sort().join(',');

  useEffect(() => {
    if (!key) {
      setState('connecting');
      return;
    }

    const watched = key.split(',');
    let socket: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let closed = false;

    const apply = (carparks: AvailabilityMap) => {
      onUpdateRef.current(carparks);
      setUpdatedAt(new Date());
    };

    const startPolling = () => {
      if (pollTimer || closed) return;
      setState('polling');
      const tick = () => fetchAvailability(watched).then(r => apply(r.carparks)).catch(() => {});
      tick();
      pollTimer = setInterval(tick, 30000);
    };

    const stopPolling = () => { if (pollTimer) clearInterval(pollTimer); pollTimer = null; };

    const connect = () => {
      if (closed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}/api/carparks/live`);

      socket.onopen = () => {
        attempt = 0;
        stopPolling();
        setState('live');
        socket?.send(JSON.stringify({ type: 'subscribe', ids: watched }));
      };

      socket.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg?.type === 'availability' && msg.carparks) apply(msg.carparks);
        } catch {}
      };

      socket.onclose = () => {
        if (closed) return;
        socket = null;
        startPolling();
        reconnectTimer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 20000));
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      closed = true;
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        const s = socket;
        if (s.readyState === 0) s.onopen = () => s.close();
        else s.close();
      }
    };
  }, [key]);

  return { state, updatedAt };
}
