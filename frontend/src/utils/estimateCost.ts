import type { CarparkRate } from '../types';

<<<<<<< HEAD
function currentDayType(): string {
  const day = new Date().getDay();
=======
function dayTypeOf(d: Date): string {
  const day = d.getDay();
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

<<<<<<< HEAD
function timeInRange(periodStart: string | null, periodEnd: string | null): boolean {
  if (!periodStart || !periodEnd) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = periodStart.split(':').map(Number);
  const [eh, em] = periodEnd.split(':').map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export function estimateCost(rates: CarparkRate[], durationHours: number, vType: string = 'C'): number | null {
  if (!rates || !rates.length) return null;

  const dayType = currentDayType();
  const totalMins = durationHours * 60;

  const matching = rates.filter(r => {
    if (r.vehicleType !== vType) return false;
    const dtMatch = r.dayType === 'all' || r.dayType === dayType
      || (dayType === 'weekday' && r.dayType === 'weekday_eve' && new Date().getHours() >= 17);
    return dtMatch && timeInRange(r.periodStart, r.periodEnd);
  });

  if (!matching.length) {
    const typeRates = rates.filter(r => r.vehicleType === vType);
    if (!typeRates.length) return null;
    const cheapest = typeRates.reduce((min, r) => r.amount < min.amount ? r : min);
    if (cheapest.durationMins && cheapest.durationMins > 0) {
      return Math.ceil(totalMins / cheapest.durationMins) * cheapest.amount;
    }
    return cheapest.amount;
  }

  const perDay = matching.find(r => r.durationMins === 1440);
  if (perDay && durationHours >= 12) return perDay.amount * Math.ceil(durationHours / 24);

  const firstRate = matching.find(r => r.isFirst);
  const subsequentRates = matching.filter(r => !r.isFirst && r.durationMins && r.durationMins > 0);

  if (firstRate && firstRate.durationMins && firstRate.durationMins > 0) {
    let cost = firstRate.amount;
    let remaining = totalMins - firstRate.durationMins;
    if (remaining <= 0) return cost;

    if (subsequentRates.length) {
      const best = subsequentRates.reduce((min, r) => r.amount < min.amount ? r : min);
      cost += Math.ceil(remaining / best.durationMins!) * best.amount;
    } else {
      cost += Math.ceil(remaining / firstRate.durationMins) * firstRate.amount;
    }
    return cost;
  }

  const perHour = matching.find(r => r.durationMins === 60);
  if (perHour) return Math.ceil(durationHours) * perHour.amount;

  const timed = matching.filter(r => r.durationMins && r.durationMins > 0);
  if (timed.length) {
    const best = timed.reduce((min, r) => r.amount / r.durationMins! < min.amount / min.durationMins! ? r : min);
    return Math.ceil(totalMins / best.durationMins!) * best.amount;
  }

  const flat = matching.find(r => !r.durationMins || r.unit === 'flat');
  if (flat) return flat.amount;

  return null;
=======
function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function matchesTime(rate: CarparkRate, minuteOfDay: number): boolean {
  if (!rate.periodStart || !rate.periodEnd) return true;
  const s = toMins(rate.periodStart);
  const e = toMins(rate.periodEnd);
  if (s <= e) return minuteOfDay >= s && minuteOfDay < e;
  return minuteOfDay >= s || minuteOfDay < e;
}

function matchesDay(rate: CarparkRate, dt: string, hour: number): boolean {
  if (rate.dayType === 'all') return true;
  if (rate.dayType === dt) return true;
  if (dt === 'weekday' && rate.dayType === 'weekday_eve' && hour >= 17) return true;
  return false;
}

function findRates(rates: CarparkRate[], at: Date): CarparkRate[] {
  const dt = dayTypeOf(at);
  const hour = at.getHours();
  const minuteOfDay = hour * 60 + at.getMinutes();
  return rates.filter(r => matchesDay(r, dt, hour) && matchesTime(r, minuteOfDay));
}

function nextBoundary(from: Date, rates: CarparkRate[]): Date {
  const midnight = new Date(from);
  midnight.setHours(23, 59, 59, 999);
  midnight.setMilliseconds(midnight.getMilliseconds() + 1);
  let earliest = midnight;

  for (const r of rates) {
    if (!r.periodEnd) continue;
    const endMins = toMins(r.periodEnd);
    const candidate = new Date(from);
    candidate.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
    if (candidate <= from) candidate.setDate(candidate.getDate() + 1);
    if (candidate < earliest) earliest = candidate;
  }

  return earliest;
}

function bestPerMinuteRate(rates: CarparkRate[]): { amount: number; durationMins: number } | null {
  const timed = rates.filter(r => r.durationMins && r.durationMins > 0 && !r.isFirst);
  const pick = (arr: CarparkRate[]) => {
    const r = arr.reduce((a, b) => a.amount / a.durationMins! < b.amount / b.durationMins! ? a : b);
    return { amount: r.amount, durationMins: r.durationMins! };
  };
  if (!timed.length) {
    const any = rates.filter(r => r.durationMins && r.durationMins > 0);
    if (!any.length) return null;
    return pick(any);
  }
  return pick(timed);
}

export function estimateCost(rates: CarparkRate[], durationHours: number, vType: string = 'C', startTime?: Date): number | null {
  if (!rates?.length || durationHours <= 0) return null;

  const vehicleRates = rates.filter(r => r.vehicleType === vType);
  if (!vehicleRates.length) return null;

  const totalMins = Math.round(durationHours * 60);

  const perDay = vehicleRates.find(r => r.durationMins === 1440);
  if (perDay && totalMins >= 1440) {
    return perDay.amount * Math.ceil(totalMins / 1440);
  }

  const start = startTime ? new Date(startTime) : new Date();
  const end = new Date(start.getTime() + totalMins * 60000);

  let cost = 0;
  let cursor = new Date(start);
  let firstUsed = false;
  let safety = 0;

  while (cursor < end && safety < 200) {
    safety++;

    const matching = findRates(vehicleRates, cursor);
    const boundary = nextBoundary(cursor, matching);
    const blockEnd = boundary < end ? boundary : end;
    const blockMins = Math.max(1, Math.round((blockEnd.getTime() - cursor.getTime()) / 60000));

    if (matching.length === 0) {
      const fallback = bestPerMinuteRate(vehicleRates);
      if (fallback) {
        cost += Math.ceil(blockMins / fallback.durationMins) * fallback.amount;
      }
      cursor = blockEnd;
      continue;
    }

    if (perDay && blockMins >= 720) {
      cost += perDay.amount;
      cursor = blockEnd;
      continue;
    }

    let remaining = blockMins;

    if (!firstUsed) {
      const firstRate = matching.find(r => r.isFirst);
      if (firstRate?.durationMins && firstRate.durationMins > 0) {
        cost += firstRate.amount;
        remaining -= firstRate.durationMins;
        firstUsed = true;
        if (remaining <= 0) {
          cursor = blockEnd;
          continue;
        }
      }
    }

    if (remaining > 0) {
      const sub = bestPerMinuteRate(matching);
      if (sub) {
        cost += Math.ceil(remaining / sub.durationMins) * sub.amount;
      } else {
        const flat = matching.find(r => !r.durationMins || r.unit === 'flat');
        if (flat) cost += flat.amount;
      }
    }

    cursor = blockEnd;
  }

  return cost > 0 ? cost : null;
>>>>>>> d022c4adbd0c79d8d8ffcc3282ee36f0e8c2d7a1
}
