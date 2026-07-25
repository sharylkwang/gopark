import { jest, describe, it, expect } from '@jest/globals';

jest.unstable_mockModule('../../src/lib/geofence', () => ({
  isInSingapore: (lat: number, lng: number) => lat >= 1.15 && lat <= 1.47 && lng >= 103.59 && lng <= 104.12,
}));

const { mergeAll } = await import('../../src/cron/pipeline/merge');
import type { CarparkRecord } from '../../src/cron/pipeline/types';

const rec = (id: string, name: string, lat: number, lng: number, over: Partial<CarparkRecord> = {}): CarparkRecord => ({
  id, name, lat, lng, address: '', agency: '', source: 'test', rates: [], availability: {}, lot_types: '', metadata: {}, ...over,
});

const dm = (records: CarparkRecord[] = [], availability = {}, agencies = {}) => ({ records, availability, agencies });

describe('mergeAll canonical ids', () => {
  it('absorbs a co-located bare-id parkaholic record into the datamall row', () => {
    const out = mergeAll(
      [], {},
      dm([rec('URA-A0024', 'ADAM RD FOOD CENTRE OFF ST', 1.3241, 103.8138)]),
      [rec('A0024', 'ADAM ROAD FOOD CENTRE OFF STREET', 1.3241, 103.8139)],
      { A0024: { availability: { C: { available: 5, total: 64 } }, agency: 'URA' } },
      {}, [], [],
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('URA-A0024');
    expect(out[0].sources.sort()).toEqual(['datamall', 'parkaholic']);
    expect(out[0].source_ids.parkaholic).toBe('A0024');
    expect(out[0].availability.C).toEqual({ available: 5, total: 64 });
  });

  it('merges a justpark mall into the datamall row by name', () => {
    const out = mergeAll(
      [], {},
      dm([rec('LTA-3', 'Raffles City', 1.29382, 103.85319)]),
      [], {}, {}, [], [],
      { records: [rec('CLND-RCS', 'Raffles City', 1.29382, 103.85319, { source: 'justpark', availability: { C: { available: 219, total: 960 } } })], availability: {} },
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('LTA-3');
    expect(out[0].sources).toContain('justpark');
    expect(out[0].agency).toBe('CapitaLand');
    expect(out[0].availability.C).toEqual({ available: 219, total: 960 });
  });

  it('keeps a standalone carpark under its own id when nothing is nearby', () => {
    const out = mergeAll([], {}, dm(), [rec('K0111', 'LIM CHU KANG LANE', 1.43, 103.71)], {}, {}, [], []);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('K0111');
    expect(out[0].sources).toEqual(['parkaholic']);
  });

  it('fills missing totals from URA capacity data', () => {
    const out = mergeAll(
      [], {},
      dm([rec('URA-X1', 'CAPACITY TEST CP', 1.35, 103.9)]),
      [], {}, {}, [], [], undefined,
      { X1: { cars: 100, motorcycles: 20, heavyVehicles: 0, lat: 1.35, lng: 103.9, name: 'CAPACITY TEST CP' } },
    );
    expect(out[0].availability.C).toEqual({ available: null, total: 100 });
    expect(out[0].availability.Y).toEqual({ available: null, total: 20 });
    expect(out[0].availability.H).toBeUndefined();
  });

  it('drops carparks outside Singapore', () => {
    const out = mergeAll([], {}, dm(), [rec('KL1', 'KUALA LUMPUR CP', 3.139, 101.6869)], {}, {}, [], []);
    expect(out).toHaveLength(0);
  });
});
