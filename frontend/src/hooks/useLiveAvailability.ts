import { useEffect, useRef, useState } from 'react';
import { fetchAvailability } from '../providers/carparks';
import type { AvailabilityMap } from '../providers/carparks';

const SOCKET_PATH = '/api/carparks/live';
const RECONNECT_MS = [1000, 2000, 5000, 10000, 20000];
const FALLBACK_POLL_MS = 30000;

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
      pollTimer = setInterval(tick, FALLBACK_POLL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (closed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${protocol}//${window.location.host}${SOCKET_PATH}`);

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
        } catch { }
      };

      socket.onclose = () => {
        if (closed) return;
        socket = null;

        startPolling();

        const delay = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)];
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
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
        if (socket.readyState === WebSocket.CONNECTING) {
          const pending = socket;
          pending.onopen = () => pending.close();
        } else {
          socket.close();
        }
      }
    };
  }, [key]);

  return { state, updatedAt };
}
