import type { RateEntry } from './types.js';

const DOLLAR = /\$\s*([\d]+\.[\d]{2}|\d+)/g;
const TIME = /(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))\s*(?:to|-)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))/i;

function toTime(raw: string): string {
  const m = raw.trim().toLowerCase().replace('.', ':').match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!m) return raw;
  let h = parseInt(m[1]);
  const mi = parseInt(m[2] ?? '0');
  if (m[3] === 'pm' && h !== 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function toDuration(text: string): number | null {
  const s = text.toLowerCase();
  const mins = s.match(/(\d+)\s*min/);
  if (mins) return parseInt(mins[1]);
  if (s.includes('half') || s.includes('½')) return 30;
  if (s.includes('hour') || s.includes('hr')) return 60;
  if (s.includes('day')) return 1440;
  if (s.includes('entry')) return -1;
  return null;
}

export function parseText(text: string, source: string, vt = 'C', day = 'all'): RateEntry[] {
  if (!text?.trim()) return [];

  const tm = text.match(TIME);
  const t0 = tm ? toTime(tm[1]) : null;
  const t1 = tm ? toTime(tm[2]) : null;
  const amounts = [...text.matchAll(DOLLAR)].map(m => parseFloat(m[1]));

  if (!amounts.length) {
    if (/free/i.test(text)) {
      return [{ amount: 0, duration_mins: null, unit: 'free', vehicle_type: vt, period_start: t0, period_end: t1, is_first: false, day_type: day, source }];
    }
    return [];
  }

  const lo = text.toLowerCase();
  const hasFirst = /(first|1st)\s+\d+/.test(lo);
  const hasSub = /subsequent|then|thereafter/.test(lo);
  const out: RateEntry[] = [];

  if (hasFirst) {
    const fm = lo.match(/(first|1st)\s+(\d+)\s*(hour|hr|hrs|hours?|min|mins|minutes?|half[- ]?hour)/);
    const n = fm ? parseInt(fm[2]) : 30;
    const u = fm?.[3] ?? 'min';
    const mult = /hour|hr/.test(u) ? 60 : /half/.test(u) ? 30 : 1;
    const dur = mult === 1 ? n : n * mult;

    out.push({ amount: amounts[0], duration_mins: dur, unit: `first_${dur}min`, vehicle_type: vt, period_start: t0, period_end: t1, is_first: true, day_type: day, source });

    if (amounts.length >= 2 && hasSub) {
      const sd = toDuration(text.slice(text.indexOf(String(amounts[1])))) ?? 30;
      out.push({ amount: amounts[1], duration_mins: sd > 0 ? sd : null, unit: sd > 0 ? `per_${sd}min` : 'per_entry', vehicle_type: vt, period_start: t0, period_end: t1, is_first: false, day_type: day, source });
    }
  } else {
    const dur = toDuration(text);
    let unit = 'flat';
    if (/entry|per entry/i.test(lo)) unit = 'per_entry';
    else if (dur && dur > 0) unit = `per_${dur}min`;
    else if (dur === -1) unit = 'per_entry';

    out.push({ amount: amounts[0], duration_mins: dur && dur > 0 ? dur : null, unit, vehicle_type: vt, period_start: t0, period_end: t1, is_first: false, day_type: day, source });
  }

  return out;
}

export function parseParkaholic(rates: Record<string, string>): RateEntry[] {
  const out: RateEntry[] = [];
  for (const [field, day] of [['weekday', 'weekday'], ['saturday', 'saturday'], ['sunday', 'sunday']] as const) {
    if (rates[field]) out.push(...parseText(rates[field], 'parkaholic', 'C', day));
  }
  if (rates.weekday_2) {
    const isMoto = /motor\s*cycle/i.test(rates.weekday_2);
    out.push(...parseText(rates.weekday_2, 'parkaholic', isMoto ? 'Y' : 'C', isMoto ? 'weekday' : 'weekday_eve'));
  }
  return out;
}

export function parseSgcarmart(meta: Record<string, unknown>): RateEntry[] {
  const out: RateEntry[] = [];
  for (const [field, day] of [['wd1', 'weekday'], ['wd2', 'weekday_eve'], ['sat', 'saturday'], ['sun', 'sunday']] as const) {
    const val = meta[field];
    if (typeof val === 'string' && val.trim()) out.push(...parseText(val, 'sgcarmart', 'C', day));
  }
  return out;
}
