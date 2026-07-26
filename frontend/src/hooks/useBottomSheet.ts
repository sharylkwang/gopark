import { useState, useEffect, useRef } from 'react';

export type SheetSnap = 'closed' | 'peek' | 'half' | 'full';

const safeAreaTop = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;

export function useBottomSheet(topInset = 0) {
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [viewportH, setViewportH] = useState(() => window.innerHeight);
  const [safeTop, setSafeTop] = useState(safeAreaTop);
  const [dragY, setDragY] = useState<number | null>(null);
  const drag = useRef({ y: 0, offset: 0, t: 0, lastY: 0, lastT: 0 });
  const frame = useRef<number | null>(null);
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const onResize = () => { setViewportH(window.innerHeight); setSafeTop(safeAreaTop()); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const height = Math.max(viewportH - topInset - safeTop, 240);
  const offsets: Record<SheetSnap, number> = { full: 0, half: Math.round(height * 0.52), peek: height - 126, closed: height };
  const order: SheetSnap[] = ['full', 'half', 'peek', 'closed'];

  const onTouchStart = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    drag.current = { y, offset: dragY ?? offsets[snap], t: e.timeStamp, lastY: y, lastT: e.timeStamp };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY;
    const next = drag.current.offset + (y - drag.current.y);
    drag.current.lastY = y;
    drag.current.lastT = e.timeStamp;

    pending.current = Math.min(Math.max(next, 0), height);
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current !== null) setDragY(pending.current);
    });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    const settled = pending.current ?? dragY;
    pending.current = null;
    if (settled === null) return;

    const elapsed = Math.max(e.timeStamp - drag.current.t, 1);
    const velocity = (drag.current.lastY - drag.current.y) / elapsed;

    if (Math.abs(velocity) > 0.5 && e.timeStamp - drag.current.lastT < 250) {
      const step = velocity > 0 ? 1 : -1;
      setSnap(order[Math.min(Math.max(order.indexOf(snap) + step, 0), order.length - 1)]);
    } else setSnap(order.reduce((best, s) => Math.abs(settled - offsets[s]) < Math.abs(settled - offsets[best]) ? s : best));
    setDragY(null);
  };

  return { snap, setSnap, height, translateY: dragY ?? offsets[snap], dragging: dragY !== null, handleProps: { onTouchStart, onTouchMove, onTouchEnd } };
}
