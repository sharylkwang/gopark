import type { CarparkRate } from '../types';

function currentDayType(): string {
  const day = new Date().getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

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
}
