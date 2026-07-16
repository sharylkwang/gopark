import type { CarparkRate } from '../types';

const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

function perMinute(rates: CarparkRate[]) {
  const pick = (arr: CarparkRate[]) => {
    const r = arr.reduce((a, b) => a.amount / a.durationMins! < b.amount / b.durationMins! ? a : b);
    return { amount: r.amount, durationMins: r.durationMins! };
  };
  const timed = rates.filter(r => r.durationMins && r.durationMins > 0 && !r.isFirst);
  if (timed.length) return pick(timed);
  const any = rates.filter(r => r.durationMins && r.durationMins > 0);
  return any.length ? pick(any) : null;
}

export function estimateCost(rates: CarparkRate[], durationHours: number, vType: string = 'C', startTime?: Date): number | null {
  if (!rates?.length || durationHours <= 0) return null;
  const vehicleRates = rates.filter(r => r.vehicleType === vType);
  if (!vehicleRates.length) return null;

  const totalMins = Math.round(durationHours * 60);
  const perDay = vehicleRates.find(r => r.durationMins === 1440);
  if (perDay && totalMins >= 1440) return perDay.amount * Math.ceil(totalMins / 1440);

  const start = startTime ? new Date(startTime) : new Date();
  const end = new Date(start.getTime() + totalMins * 60000);
  let cost = 0, cursor = new Date(start), firstUsed = false;

  for (let guard = 0; cursor < end && guard < 200; guard++) {
    const day = cursor.getDay(), dt = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
    const hour = cursor.getHours(), mins = hour * 60 + cursor.getMinutes();

    const matching = vehicleRates.filter(r => {
      const dayOk = r.dayType === 'all' || r.dayType === dt || (dt === 'weekday' && r.dayType === 'weekday_eve' && hour >= 17);
      if (!dayOk) return false;
      if (!r.periodStart || !r.periodEnd) return true;
      const s = toMins(r.periodStart), e = toMins(r.periodEnd);
      return s <= e ? mins >= s && mins < e : mins >= s || mins < e;
    });

    let boundary = new Date(cursor);
    boundary.setHours(23, 59, 59, 999);
    boundary.setMilliseconds(boundary.getMilliseconds() + 1);
    for (const r of matching) {
      if (!r.periodEnd) continue;
      const em = toMins(r.periodEnd), c = new Date(cursor);
      c.setHours(Math.floor(em / 60), em % 60, 0, 0);
      if (c <= cursor) c.setDate(c.getDate() + 1);
      if (c < boundary) boundary = c;
    }
    const blockEnd = boundary < end ? boundary : end;
    const blockMins = Math.max(1, Math.round((blockEnd.getTime() - cursor.getTime()) / 60000));

    if (!matching.length) {
      const fb = perMinute(vehicleRates);
      if (fb) cost += Math.ceil(blockMins / fb.durationMins) * fb.amount;
      cursor = blockEnd;
      continue;
    }

    if (perDay && blockMins >= 720) { cost += perDay.amount; cursor = blockEnd; continue; }

    let remaining = blockMins;
    if (!firstUsed) {
      const first = matching.find(r => r.isFirst);
      if (first?.durationMins && first.durationMins > 0) {
        cost += first.amount;
        remaining -= first.durationMins;
        firstUsed = true;
        if (remaining <= 0) { cursor = blockEnd; continue; }
      }
    }

    if (remaining > 0) {
      const sub = perMinute(matching);
      if (sub) cost += Math.ceil(remaining / sub.durationMins) * sub.amount;
      else {
        const flat = matching.find(r => !r.durationMins || r.unit === 'flat');
        if (flat) cost += flat.amount;
      }
    }
    cursor = blockEnd;
  }

  return cost > 0 ? cost : null;
}
