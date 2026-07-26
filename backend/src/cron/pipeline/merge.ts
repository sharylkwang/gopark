import type { CarparkRecord, RateEntry, AvailabilityEntry, MergedCarpark, DatamallResult, ScrapedResult, JustParkResult } from './types.js';
import { parseParkaholic, parseSgcarmart } from './rates.js';
import { MERGE } from '../config.js';
import { isInSingapore } from '../../lib/geofence.js';

export const VT_MAP: Record<string, string> = { car: 'C', motorcycle: 'Y', heavy_vehicle: 'H' };

function ratesMatch(a: RateEntry, b: RateEntry) {
  return a.amount === b.amount && a.duration_mins === b.duration_mins
    && a.vehicle_type === b.vehicle_type && a.day_type === b.day_type
    && a.period_start === b.period_start && a.period_end === b.period_end;
}

export function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findByProximity(map: Record<string, MergedCarpark>, lat: number, lng: number, threshold: number): MergedCarpark | null {
  let best: MergedCarpark | null = null;
  let bestD = threshold;
  for (const cp of Object.values(map)) {
    const d = Math.hypot(cp.lat - lat, cp.lng - lng);
    if (d < bestD) { bestD = d; best = cp; }
  }
  return best;
}

function findByName(map: Record<string, MergedCarpark>, name: string): MergedCarpark | null {
  const norm = normalize(name);
  if (norm.length < 4) return null;
  for (const cp of Object.values(map)) {
    const existing = normalize(cp.name || cp.address);
    if (!existing) continue;
    if (norm === existing || norm.includes(existing) || existing.includes(norm)) return cp;
  }
  return null;
}

const ID_PREFIXES = ['URA-', 'LTA-'];

function isSamePlace(a: MergedCarpark, b: MergedCarpark): boolean {
  return Math.abs(a.lat - b.lat) <= MERGE.proximityThreshold && Math.abs(a.lng - b.lng) <= MERGE.proximityThreshold;
}

export function collapsePrefixTwins(map: Record<string, MergedCarpark>): number {
  let merged = 0;
  for (const id of Object.keys(map)) {
    const prefix = ID_PREFIXES.find(p => id.startsWith(p));
    if (!prefix) continue;
    const bare = map[id.slice(prefix.length)];
    if (!bare || !isSamePlace(bare, map[id])) continue;

    const dup = map[id];
    for (const s of dup.sources) if (!bare.sources.includes(s)) bare.sources.push(s);
    for (const [k, v] of Object.entries(dup.source_ids)) if (!(k in bare.source_ids)) bare.source_ids[k] = v;
    for (const [lt, e] of Object.entries(dup.availability)) {
      const cur = bare.availability[lt];
      if (!cur) bare.availability[lt] = { ...e };
      else {
        if (cur.available == null && e.available != null) cur.available = e.available;
        if (!cur.total && e.total) cur.total = e.total;
      }
    }
    const rateKey = (r: RateEntry) => `${r.vehicle_type}|${r.day_type}|${r.unit}|${r.amount}|${r.period_start ?? ''}`;
    const seen = new Set(bare.rates.map(rateKey));
    for (const r of dup.rates) if (!seen.has(rateKey(r))) { bare.rates.push(r); seen.add(rateKey(r)); }
    bare.address = bare.address || dup.address;
    bare.agency = bare.agency || dup.agency;
    Object.assign(bare.metadata, dup.metadata);

    delete map[id];
    merged++;
  }
  return merged;
}

function findExisting(map: Record<string, MergedCarpark>, id: string, name: string, lat: number, lng: number): MergedCarpark | null {
  if (map[id]) return map[id];
  const byProx = findByProximity(map, lat, lng, MERGE.proximityThreshold);
  if (byProx) return byProx;
  return findByName(map, name);
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
  justpark?: JustParkResult,
  uraCap?: Record<string, { cars: number; motorcycles: number; heavyVehicles: number; lat: number; lng: number; name: string }>,
): MergedCarpark[] {
  const map: Record<string, MergedCarpark> = {};
  const ts = new Date().toISOString();

  function touch(id: string, name: string, lat: number, lng: number): MergedCarpark {
    if (!map[id]) {
      map[id] = { id, name, lat, lng, address: '', agency: '', sources: [], source_ids: {}, source_count: 0, rates: [], availability: {}, lot_types: '', metadata: {}, last_updated: ts };
    }
    return map[id];
  }

  function addSource(cp: MergedCarpark, source: string, sourceId: string) {
    if (!cp.sources.includes(source)) cp.sources.push(source);
    cp.source_ids[source] = sourceId;
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

  function mergeAvailability(cp: MergedCarpark, avail: Record<string, AvailabilityEntry>) {
    for (const [lt, e] of Object.entries(avail)) {
      const cur = cp.availability[lt];
      if (!cur) {
        cp.availability[lt] = { ...e };
      } else {
        if (e.available != null) cur.available = e.available;
        if (e.total != null) cur.total = e.total;
      }
    }
  }

  for (const r of gov) {
    const cp = touch(r.id, r.name, r.lat, r.lng);
    cp.address = r.address;
    cp.agency = 'HDB';
    addSource(cp, 'gov', r.id);
    Object.assign(cp.metadata, r.metadata);
    if (govAvail[r.id]) mergeAvailability(cp, govAvail[r.id]);
  }

  const datamallTargets: Record<string, MergedCarpark> = {};
  for (const r of datamall.records) {
    const existing = findExisting(map, r.id, r.name, r.lat, r.lng);
    if (existing) {
      existing.address = existing.address || r.address;
      existing.agency = existing.agency || (r.metadata.agency as string) || '';
      addSource(existing, 'datamall', r.id);
      Object.assign(existing.metadata, r.metadata);
      datamallTargets[r.id] = existing;
    } else {
      const cp = touch(r.id, r.name, r.lat, r.lng);
      cp.address = r.address;
      cp.agency = (r.metadata.agency as string) || '';
      addSource(cp, 'datamall', r.id);
      Object.assign(cp.metadata, r.metadata);
      datamallTargets[r.id] = cp;
    }
  }
  for (const [id, lots] of Object.entries(datamall.availability)) {
    const target = map[id] ?? datamallTargets[id];
    if (!target) continue;
    mergeAvailability(target, lots);
    const a = datamall.agencies[id];
    if (a) { target.agency = target.agency || a.agency; if (a.area) target.metadata.area = a.area; }
  }

  for (const r of parkLocs) {
    const existing = findExisting(map, r.id, r.name, r.lat, r.lng);
    const cp = existing || touch(r.id, r.name, r.lat, r.lng);
    addSource(cp, 'parkaholic', r.id);
    cp.lot_types = cp.lot_types || r.lot_types;

    const d = parkDump[r.id];
    if (d) {
      cp.agency = cp.agency || d.agency;
      mergeAvailability(cp, d.availability);
    }
    if (parkRates[r.id]) addRates(cp, parseParkaholic(parkRates[r.id]));
  }

  if (sgcarmart.length) {
    for (const r of sgcarmart) {
      const existing = findExisting(map, r.id, r.name, r.lat, r.lng);
      const rates = parseSgcarmart(r.metadata);

      if (existing) {
        addSource(existing, 'sgcarmart', r.id);
        addRates(existing, rates);
      } else {
        const cp = touch(r.id, r.name, r.lat, r.lng);
        cp.address = r.address;
        addSource(cp, 'sgcarmart', r.id);
        addRates(cp, rates);
      }
    }
  }

  if (justpark) {
    for (const r of justpark.records) {
      const existing = findByName(map, r.name);
      if (existing) {
        addSource(existing, 'justpark', r.id);
        addRates(existing, r.rates);
        mergeAvailability(existing, r.availability);
        existing.agency = existing.agency || 'CapitaLand';
        Object.assign(existing.metadata, r.metadata);
      } else {
        const cp = touch(r.id, r.name, r.lat, r.lng);
        cp.address = r.address;
        cp.agency = 'CapitaLand';
        addSource(cp, 'justpark', r.id);
        addRates(cp, r.rates);
        mergeAvailability(cp, r.availability);
        Object.assign(cp.metadata, r.metadata);
      }
    }
  }

  for (const { source, carparks } of scraped) {
    for (const ai of carparks) {
      const name = (ai.name ?? '').toLowerCase();
      if (name.length < 4) continue;
      const match = findByName(map, name);
      if (!match) continue;

      addRates(match, ai.rates.map(r => ({
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
      addSource(match, source, ai.name);
    }
  }

  if (uraCap) {
    const uraEntries = Object.entries(uraCap);
    for (const cp of Object.values(map)) {
      const uraId = cp.source_ids['datamall']?.replace('URA-', '');
      let place = uraId ? uraCap[uraId] : null;

      if (!place) {
        for (const [, p] of uraEntries) {
          if (Math.hypot(cp.lat - p.lat, cp.lng - p.lng) < MERGE.proximityThreshold) {
            place = p;
            break;
          }
        }
      }

      if (!place) continue;

      if (place.cars > 0) {
        if (cp.availability['C'] && !cp.availability['C'].total) cp.availability['C'].total = place.cars;
        else if (!cp.availability['C']) cp.availability['C'] = { available: null, total: place.cars };
      }
      if (place.motorcycles > 0) {
        if (cp.availability['Y'] && !cp.availability['Y'].total) cp.availability['Y'].total = place.motorcycles;
        else if (!cp.availability['Y']) cp.availability['Y'] = { available: null, total: place.motorcycles };
      }
      if (place.heavyVehicles > 0) {
        if (cp.availability['H'] && !cp.availability['H'].total) cp.availability['H'].total = place.heavyVehicles;
        else if (!cp.availability['H']) cp.availability['H'] = { available: null, total: place.heavyVehicles };
      }
    }
  }

  collapsePrefixTwins(map);

  const LT_NAMES: Record<string, string> = { C: 'Car', Y: 'Motorcycle', H: 'Heavy Vehicle' };
  return Object.values(map)
    .filter(cp => isInSingapore(cp.lat, cp.lng))
    .map(cp => {
      const availTypes = Object.keys(cp.availability).map(k => LT_NAMES[k]).filter(Boolean);
      if (availTypes.length && !cp.lot_types) cp.lot_types = availTypes.join(', ');
      else if (availTypes.length) {
        const existing = new Set(cp.lot_types.split(',').map(s => s.trim()));
        for (const t of availTypes) if (!existing.has(t)) cp.lot_types += `, ${t}`;
      }
      return { ...cp, sources: [...new Set(cp.sources)], source_count: new Set(cp.sources).size };
    });
}
