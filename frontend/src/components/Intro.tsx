import { useState, useEffect } from 'react';

const SEEN_KEY = 'gopark_intro_seen';
const PLAY_MS = 2100;
const LEAVE_MS = 450;

const BOLT_PATH = 'M13 2 3 14h9l-1 8 10-12h-9l1-8z';

const ARCS = [
  { d: 'M13 2 L15 -1 L13.4 -2.6 L16.2 -5.4', delay: 0 },
  { d: 'M3 14 L0 15.4 L1.6 17.6 L-1.8 19.2', delay: 0.35 },
  { d: 'M21 10 L24.2 8.2 L22.6 5.8 L25.8 3.8', delay: 0.7 },
  { d: 'M11 22 L9.8 25 L11.8 26.6 L10.2 29.4', delay: 0.5 },
];

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  return {
    dx: `${Math.cos(angle) * (70 + (i % 4) * 26)}px`,
    dy: `${Math.sin(angle) * (70 + (i % 3) * 30)}px`,
    delay: 0.85 + (i % 5) * 0.05,
    size: i % 3 === 0 ? 5 : 3,
  };
});

function shouldSkip() {
  if (sessionStorage.getItem(SEEN_KEY)) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isDark() {
  const saved = localStorage.getItem('gopark_dark');
  if (saved !== null) return saved === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function Intro() {
  const [dark] = useState(isDark);
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'gone'>(
    () => (shouldSkip() ? 'gone' : 'playing'),
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    sessionStorage.setItem(SEEN_KEY, '1');
    const t = setTimeout(() => setPhase('leaving'), PLAY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = setTimeout(() => setPhase('gone'), LEAVE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      onClick={() => setPhase('leaving')}
      className={`fixed inset-0 z-[100] grid place-items-center cursor-pointer ${
        dark ? 'bg-[#0d1013]' : 'bg-white'
      } ${phase === 'leaving' ? 'intro-leaving' : ''}`}>
      <div className={`intro-flash absolute inset-0 pointer-events-none ${dark ? 'bg-yellow-200/45' : 'bg-yellow-300/35'}`} />

      <div className="relative flex flex-col items-center gap-7 px-8">
        <div className="relative grid place-items-center">
          {SPARKS.map((s, i) => (
            <span key={i}
              style={{
                '--dx': s.dx,
                '--dy': s.dy,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
              } as React.CSSProperties}
              className="intro-spark absolute rounded-full bg-yellow-300" />
          ))}

          <svg width="150" height="150" viewBox="-8 -8 40 40" fill="none"
            className="intro-bolt-glow relative overflow-visible">
            <path d={BOLT_PATH}
              className="intro-bolt-stroke"
              stroke="#facc15" strokeWidth="1.1"
              strokeLinecap="round" strokeLinejoin="round" />
            <path d={BOLT_PATH}
              className="intro-bolt-fill"
              fill="#facc15" stroke="#facc15" strokeWidth="0.6"
              strokeLinejoin="round" />

            {ARCS.map((a, i) => (
              <path key={i} d={a.d}
                className="intro-arc"
                style={{ animationDelay: `${a.delay}s` }}
                stroke={dark ? '#fef9c3' : '#f59e0b'} strokeWidth="0.5"
                strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
          </svg>
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1 className={`intro-wordmark text-3xl font-black italic uppercase tracking-[0.06em] ${dark ? 'text-white' : 'text-[#0d1013]'}`}>
            GoPark
          </h1>

          <div className={`h-[3px] w-44 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-black/10'}`}>
            <div className="intro-charge h-full w-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300" />
          </div>

          <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${dark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
            Smart parking. Fast.
          </p>
        </div>
      </div>
    </div>
  );
}
