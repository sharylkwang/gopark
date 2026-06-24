import sgcarmartClient from '../../lib/sgcarmartClient';
import type { CarparkRecord } from '../pipeline/types.js';
import { SGCARMART } from '../config.js';

async function fetchOne(id: number): Promise<CarparkRecord | null> {
  try {
    const { data } = await sgcarmartClient.get('/fetch-carpark-detail-data', { params: { id } });
    if (!data?.data?.success) return null;
    const d = data.data.data;
    return {
      id: `SGC-${id}`, name: d.name, lat: d.latitude, lng: d.longitude, address: d.address ?? '',
      agency: '', source: 'sgcarmart', rates: [], availability: {}, lot_types: '',
      metadata: { sgc_id: id, wd1: d.wd1 ?? '', wd2: d.wd2 ?? '', sat: d.sat ?? '', sun: d.sun ?? '', remarks: d.remarks ?? '' },
    };
  } catch { return null; }
}

export async function fetchSgcarmart(): Promise<CarparkRecord[]> {
  const out: CarparkRecord[] = [];
  for (let i = 1; i <= SGCARMART.maxId; i += SGCARMART.concurrency) {
    const batch = Array.from({ length: Math.min(SGCARMART.concurrency, SGCARMART.maxId - i + 1) }, (_, j) => i + j);
    const results = await Promise.allSettled(batch.map(fetchOne));
    for (const r of results) if (r.status === 'fulfilled' && r.value) out.push(r.value);
  }
  return out;
}
