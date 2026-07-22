import { useEffect, useMemo, useState } from 'react';
import { fetchTrend } from '../providers/trends';
import type { CarparkTrend } from '../providers/trends';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const START_HOUR = 6;
const END_HOUR = 24;

function busyLabel(pct: number): string {
  if (pct >= 85) return 'Usually packed';
  if (pct >= 65) return 'Usually busy';
  if (pct >= 40) return 'Steady';
  if (pct >= 20) return 'Usually quiet';
  return 'Usually empty';
}

function barColor(pct: number, isNow: boolean, darkMode: boolean): string {
  if (isNow) return '#facc15';
  if (pct >= 80) return '#ef4444';
  if (pct >= 55) return '#f59e0b';
  if (pct >= 30) return '#22c55e';
  return darkMode ? '#3f4753' : '#cbd5e1';
}

export function PopularTimes({ carparkId, darkMode }: { carparkId: string; darkMode: boolean }) {
  const [trend, setTrend] = useState<CarparkTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(() => new Date().getDay());

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTrend(carparkId).then(t => { if (active) { setTrend(t); setLoading(false); } });
    return () => { active = false; };
  }, [carparkId]);

  const today = new Date().getDay();
  const nowHour = new Date().getHours();

  const hours = useMemo(() => {
    if (!trend) return [];
    const profile = day === today ? trend.today : trend.weekday?.[String(day)] ?? trend.today;
    const out: { hour: number; pct: number }[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) out.push({ hour: h, pct: Math.max(0, Math.min(100, profile[h] ?? 0)) });
    return out;
  }, [trend, day, today]);

  const tone = (dark: string, light: string) => (darkMode ? dark : light);

  if (loading) {
    return <div className={`h-24 rounded-xl animate-pulse ${tone('bg-white/5', 'bg-gray-100')}`} />;
  }
  if (!trend || !hours.length) return null;

  const nowPct = day === today && nowHour >= START_HOUR && nowHour < END_HOUR
    ? hours.find(h => h.hour === nowHour)?.pct ?? null
    : null;

  const estimated = trend.todaySource === 'default' || trend.sampleCount === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className={`text-[9px] font-black uppercase tracking-widest ${tone('text-gray-500', 'text-gray-400')}`}>Popular Times</h3>
        {trend.isHoliday && trend.holidayName && (
          <span className="text-[9px] font-black uppercase tracking-wider text-red-500">{trend.holidayName}</span>
        )}
      </div>

      {nowPct != null && (
        <p className={`text-[12px] font-bold ${tone('text-gray-200', 'text-gray-700')}`}>
          Right now: <span className="text-yellow-500">{busyLabel(nowPct)}</span>
          <span className={`ml-1 font-medium ${tone('text-gray-500', 'text-gray-400')}`}>· {nowPct}% full</span>
        </p>
      )}

      <div className="flex items-end gap-[3px] h-20">
        {hours.map(({ hour, pct }) => {
          const isNow = day === today && hour === nowHour;
          return (
            <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full" title={`${hour}:00 — ${pct}% full`}>
              <div className="w-full rounded-t-sm transition-all"
                style={{ height: `${Math.max(4, pct)}%`, background: barColor(pct, isNow, darkMode) }} />
            </div>
          );
        })}
      </div>

      <div className={`flex justify-between text-[8px] font-semibold ${tone('text-gray-600', 'text-gray-400')}`}>
        <span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {DAYS.map((label, d) => (
          <button key={d} onClick={() => setDay(d)}
            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors ${
              d === day
                ? 'bg-yellow-400 text-[#0d1013]'
                : tone('bg-white/5 text-gray-400', 'bg-gray-100 text-gray-500')
            }`}>
            {label}
          </button>
        ))}
      </div>

      {estimated && (
        <p className={`text-[9px] font-medium italic ${tone('text-gray-600', 'text-gray-400')}`}>
          Estimated pattern — live data still accruing
        </p>
      )}
    </div>
  );
}
