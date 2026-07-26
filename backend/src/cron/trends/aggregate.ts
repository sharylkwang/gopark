import { isPublicHoliday, isoDate, sameDateLastYear } from '../../lib/holidays.js';

export interface Snapshot {
  occupancyPct: number;
  recordedAt: Date;
}

export type HourlyProfile = number[];
export type WeekdayProfile = Record<number, HourlyProfile>;

export interface Trend {
  weekday: WeekdayProfile;
  today: HourlyProfile;
  todaySource: 'observed' | 'holiday-last-year' | 'own-average' | 'default';
  isHoliday: boolean;
  sampleCount: number;
}

const HOURS = 24;
const MIN_SAMPLES_PER_HOUR = 1;

export function occupancyPct(available: number | null, total: number | null): number | null {
  if (available == null || total == null || total <= 0) return null;
  const used = Math.max(0, total - available);
  return Math.round(Math.min(100, (used / total) * 100));
}

const DEFAULT_CURVE: HourlyProfile = [
  20, 15, 12, 10, 10, 12, 25, 45, 62, 68, 66, 70,
  74, 70, 66, 64, 68, 78, 82, 76, 64, 52, 40, 28,
];

export function defaultTrend(): HourlyProfile {
  return [...DEFAULT_CURVE];
}

function ownAverage(snapshots: Snapshot[]): HourlyProfile | null {
  if (!snapshots.length) return null;
  const { profile, counts } = averageByHour(snapshots);
  return fillGaps(profile, counts);
}

function averageByHour(snapshots: Snapshot[]): { profile: HourlyProfile; counts: number[] } {
  const sums = new Array(HOURS).fill(0);
  const counts = new Array(HOURS).fill(0);
  for (const s of snapshots) {
    const h = s.recordedAt.getHours();
    sums[h] += s.occupancyPct;
    counts[h] += 1;
  }
  const profile = sums.map((sum, h) => (counts[h] ? Math.round(sum / counts[h]) : -1));
  return { profile, counts };
}

function fillGaps(profile: HourlyProfile, counts: number[]): HourlyProfile {
  return profile.map((v, h) => (counts[h] >= MIN_SAMPLES_PER_HOUR && v >= 0 ? v : DEFAULT_CURVE[h]));
}

export function buildWeekdayProfile(snapshots: Snapshot[]): { weekday: WeekdayProfile; sampleCount: number } {
  const buckets: Record<number, Snapshot[]> = {};
  for (let d = 0; d < 7; d++) buckets[d] = [];
  for (const s of snapshots) buckets[s.recordedAt.getDay()].push(s);

  const weekday: WeekdayProfile = {};
  for (let d = 0; d < 7; d++) {
    const { profile, counts } = averageByHour(buckets[d]);
    weekday[d] = fillGaps(profile, counts);
  }
  return { weekday, sampleCount: snapshots.length };
}

export function resolveTrend(snapshots: Snapshot[], today: Date): Trend {
  const { weekday, sampleCount } = buildWeekdayProfile(snapshots);
  const holiday = isPublicHoliday(today);

  if (holiday) {
    const target = isoDate(sameDateLastYear(today));
    const lastYear = snapshots.filter(s => isoDate(s.recordedAt) === target);
    if (lastYear.length >= HOURS / 2) {
      const { profile, counts } = averageByHour(lastYear);
      return { weekday, today: fillGaps(profile, counts), todaySource: 'holiday-last-year', isHoliday: true, sampleCount };
    }
    return { weekday, today: ownAverage(snapshots) ?? defaultTrend(), todaySource: snapshots.length ? 'own-average' : 'default', isHoliday: true, sampleCount };
  }

  const observed = weekday[today.getDay()];
  const hasRealData = snapshots.some(s => s.recordedAt.getDay() === today.getDay());
  const fallback = ownAverage(snapshots);
  return {
    weekday,
    today: hasRealData ? observed : fallback ?? defaultTrend(),
    todaySource: hasRealData ? 'observed' : fallback ? 'own-average' : 'default',
    isHoliday: false,
    sampleCount,
  };
}
