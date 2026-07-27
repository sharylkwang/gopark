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
    const typing = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    };
    const update = () => { if (!typing()) setMode(currentMode()); };
    queries.forEach(q => q.addEventListener('change', update));
    document.addEventListener('focusout', update);
    return () => {
      queries.forEach(q => q.removeEventListener('change', update));
      document.removeEventListener('focusout', update);
    };
  }, []);

  return mode;
}
