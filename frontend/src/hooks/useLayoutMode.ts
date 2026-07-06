import { useState, useEffect } from 'react';

export type LayoutMode = 'desktop' | 'sheet' | 'rail';

const COMPACT = '(max-width: 767px), (max-height: 520px)';
const LANDSCAPE = '(orientation: landscape)';

function currentMode(): LayoutMode {
  if (!window.matchMedia(COMPACT).matches) return 'desktop';
  return window.matchMedia(LANDSCAPE).matches ? 'rail' : 'sheet';
}

export function useLayoutMode() {
  const [mode, setMode] = useState<LayoutMode>(currentMode);

  useEffect(() => {
    const queries = [window.matchMedia(COMPACT), window.matchMedia(LANDSCAPE)];
    const update = () => setMode(currentMode());
    queries.forEach(q => q.addEventListener('change', update));
    return () => queries.forEach(q => q.removeEventListener('change', update));
  }, []);

  return mode;
}
