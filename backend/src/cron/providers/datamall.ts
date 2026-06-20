import datamallClient from '../../lib/datamallClient';
import type { CarparkRecord, AvailabilityEntry, DatamallResult } from '../pipeline/types.js';

export async function fetchDatamall(): Promise<DatamallResult> {
  if (!process.env.DATAMALL_API) throw new Error('DATAMALL_API not set');

  const raw: Record<string, string>[] = [];
  let skip = 0;
  while (true) {
    const { data } = await datamallClient.get('/CarParkAvailabilityv2', { params: { $skip: skip } });
    const batch = data.value ?? [];
    if (!batch.length) break;
    raw.push(...batch);
    skip += 500;
  }

  const byId: Record<string, { id: string; rawId: string; agency: string; dev: string; area: string; lat: number; lng: number; avail: Record<string, AvailabilityEntry> }> = {};

  for (const rec of raw) {
    const cpid = (rec.CarParkID ?? '').trim();
    const agency = (rec.Agency ?? '').trim();
    if (!cpid) continue;
    const fid = ['LTA', 'URA'].includes(agency) ? `${agency}-${cpid}` : cpid;

    if (!byId[fid]) {
      let lat = 0, lng = 0;
      const loc = rec.Location ?? '';
      if (loc.includes(' ')) { const p = loc.split(' '); lat = parseFloat(p[0]) || 0; lng = parseFloat(p[1]) || 0; }
      byId[fid] = { id: fid, rawId: cpid, agency, dev: rec.Development ?? '', area: rec.Area ?? '', lat, lng, avail: {} };
    }

    const avail = parseInt(rec.AvailableLots) || 0;
    byId[fid].avail[rec.LotType ?? 'C'] = { available: avail, total: null };
  }

  const records: CarparkRecord[] = [];
  const availability: Record<string, Record<string, AvailabilityEntry>> = {};
  const agencies: Record<string, { agency: string; area: string; development: string }> = {};

  for (const [fid, cp] of Object.entries(byId)) {
    availability[fid] = cp.avail;
    agencies[fid] = { agency: cp.agency, area: cp.area, development: cp.dev };
    if (['LTA', 'URA'].includes(cp.agency) && cp.lat) {
      records.push({
        id: fid, name: cp.dev, lat: cp.lat, lng: cp.lng, address: cp.dev,
        agency: cp.agency, source: 'datamall', rates: [], availability: cp.avail, lot_types: '',
        metadata: { agency: cp.agency, area: cp.area, raw_id: cp.rawId },
      });
    }
  }

  return { records, availability, agencies };
}
