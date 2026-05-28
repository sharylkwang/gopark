import type { CarparkRecord, RateEntry, AvailabilityEntry, MergedCarpark, DatamallResult, ScrapedResult } from './types.js';
import { parseParkaholic, parseSgcarmart } from './rates.js';
import { MERGE } from '../config.js';
import { isInSingapore } from '../../lib/geofence.js';

const VT_MAP: Record<string, string> = { car: 'C', motorcycle: 'Y', heavy_vehicle: 'H' };

function ratesMatch(a: RateEntry, b: RateEntry) {
  return a.amount === b.amount && a.duration_mins === b.duration_mins
    && a.vehicle_type === b.vehicle_type && a.day_type === b.day_type
    && a.period_start === b.period_start && a.period_end === b.period_end;
}

export function mergeAll(
  gov: CarparkRecord[],
  govAvail: Record<string, Record<string, AvailabilityEntry>>,
  datamall: DatamallResult,
  parkLocs: CarparkRecord[],
  parkDump: Record<string, { availability: Record<string, AvailabilityEntry>; agency: string }>,
  parkRates: Record<string, Record<string, string>>,
  sgcarmart: CarparkRecord[],
  scraped: ScrapedResult[],
): MergedCarpark[] {
  const map: Record<string, MergedCarpark> = {};
  const ts = new Date().toISOString();

  function touch(id: string, name: string, lat: number, lng: number) {
    if (!map[id]) {
      map[id] = { id, name, lat, lng, address: '', agency: '', sources: [], source_count: 0, rates: [], availability: {}, lot_types: '', metadata: {}, last_updated: ts };
    }
    return map[id];
  }

  function addRates(cp: MergedCarpark, incoming: RateEntry[]) {
    for (const nr of incoming) {
      const hit = cp.rates.find(r => ratesMatch(r, nr));
      if (hit) {
        if (!hit.sources.includes(nr.source)) { hit.sources.push(nr.source); hit.confirmed_by = hit.sources.length; }
      } else {
        cp.rates.push({ ...nr, sources: [nr.source], confirmed_by: 1 });
      }
    }
  }

  for (const r of gov) {
    const cp = touch(r.id, r.name, r.lat, r.lng);
    cp.address = r.address;
    cp.agency = 'HDB';
    cp.sources.push('gov');
    Object.assign(cp.metadata, r.metadata);
    if (govAvail[r.id]) Object.assign(cp.availability, govAvail[r.id]);
  }

  for (const r of datamall.records) {
    const cp = touch(r.id, r.name, r.lat, r.lng);
    cp.address = r.address || cp.address;
    cp.agency = (r.metadata.agency as string) || cp.agency;
    cp.sources.push('datamall');
    Object.assign(cp.metadata, r.metadata);
  }
  for (const [id, lots] of Object.entries(datamall.availability)) {
    if (!map[id]) continue;
    for (const [lt, e] of Object.entries(lots)) if (!map[id].availability[lt]) map[id].availability[lt] = e;
    const a = datamall.agencies[id];
    if (a) { map[id].agency = map[id].agency || a.agency; if (a.area) map[id].metadata.area = a.area; }
  }

  for (const r of parkLocs) {
    const cp = touch(r.id, r.name, r.lat, r.lng);
    cp.sources.push('parkaholic');
    cp.lot_types = cp.lot_types || r.lot_types;
    const d = parkDump[r.id];
    if (d) {
      cp.agency = cp.agency || d.agency;
      for (const [lt, e] of Object.entries(d.availability)) if (!cp.availability[lt]) cp.availability[lt] = e;
    }
    if (parkRates[r.id]) addRates(cp, parseParkaholic(parkRates[r.id]));
  }

  if (sgcarmart.length) {
    const coords = Object.values(map).map(cp => [cp.lat, cp.lng] as [number, number]);
    const ids = Object.keys(map);

    for (const r of sgcarmart) {
      let bestD = Infinity, bestI = -1;
      for (let i = 0; i < coords.length; i++) {
        const d = Math.hypot(coords[i][0] - r.lat, coords[i][1] - r.lng);
        if (d < bestD) { bestD = d; bestI = i; }
      }

      const rates = parseSgcarmart(r.metadata);
      if (bestD < MERGE.proximityThreshold && bestI >= 0) {
        const cp = map[ids[bestI]];
        cp.sources.push('sgcarmart');
        addRates(cp, rates);
        cp.metadata.sgc_id = r.metadata.sgc_id;
      } else {
        const cp = touch(r.id, r.name, r.lat, r.lng);
        cp.address = r.address;
        cp.sources.push('sgcarmart');
        addRates(cp, rates);
      }
    }
  }

  for (const { source, carparks } of scraped) {
    for (const ai of carparks) {
      const name = (ai.name ?? '').toLowerCase();
      if (name.length < 4) continue;
      for (const cp of Object.values(map)) {
        const existing = (cp.name || cp.address || '').toLowerCase();
        if (!existing || !(name.includes(existing) || existing.includes(name))) continue;
        addRates(cp, ai.rates.map(r => ({
          amount: r.amount_dollars ?? 0,
          duration_mins: r.per_minutes ?? null,
          unit: r.per_minutes ? `per_${r.per_minutes}min` : 'flat',
          vehicle_type: VT_MAP[r.vehicle_type ?? 'car'] ?? 'C',
          period_start: r.time_start ?? null,
          period_end: r.time_end ?? null,
          is_first: r.is_first_block ?? false,
          day_type: r.day_type ?? 'all',
          source,
        })));
        cp.sources.push(source);
        break;
      }
    }
  }

  return Object.values(map)
    .filter(cp => isInSingapore(cp.lat, cp.lng))
    .map(cp => ({ ...cp, sources: [...new Set(cp.sources)], source_count: new Set(cp.sources).size }));
}
