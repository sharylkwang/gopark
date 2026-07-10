import { jest, describe, it, expect } from '@jest/globals';
import type { CarparkRecord, DatamallResult } from '../../src/cron/pipeline/types';
import { buildSourceIdIndex, resolveCarparkId, planAvailabilityWrite } from '../../src/cron/pipeline/refresh';

jest.unstable_mockModule('../../src/lib/geofence', () => ({
  isInSingapore: () => true,
}));

const { mergeAll } = await import('../../src/cron/pipeline/merge');

function govRecord(id: string, lat: number, lng: number): CarparkRecord {
  return {
    id, name: `${id} CARPARK`, lat, lng, address: `${id} STREET`,
    agency: 'HDB', source: 'gov', rates: [], availability: {}, lot_types: '', metadata: {},
  };
}

function datamallRecord(id: string, lat: number, lng: number): CarparkRecord {
  return {
    id, name: 'Some Development', lat, lng, address: 'Some Development',
    agency: 'URA', source: 'datamall', rates: [], availability: {}, lot_types: '',
    metadata: { agency: 'URA' },
  };
}

function parkaholicRecord(id: string, lat: number, lng: number): CarparkRecord {
  return {
    id, name: `${id} LOCATION`, lat, lng, address: '', agency: '',
    source: 'parkaholic', rates: [], availability: {}, lot_types: 'C',
    metadata: {},
  };
}

const emptyDatamall: DatamallResult = { records: [], availability: {}, agencies: {} };

describe('mergeAll availability routing', () => {
  it('applies datamall availability to a carpark the datamall record merged into by proximity', () => {
    const datamall: DatamallResult = {
      records: [datamallRecord('URA-X1', 1.3001, 103.8001)],
      availability: { 'URA-X1': { C: { available: 12, total: null } } },
      agencies: { 'URA-X1': { agency: 'URA', area: 'Downtown', development: 'Some Development' } },
    };

    const merged = mergeAll([govRecord('ACB', 1.3, 103.8)], {}, datamall, [], {}, {}, [], []);

    expect(merged).toHaveLength(1);
    const cp = merged[0];
    expect(cp.id).toBe('ACB');
    expect(cp.source_ids['datamall']).toBe('URA-X1');
    expect(cp.availability['C']).toEqual({ available: 12, total: null });
    expect(cp.metadata.area).toBe('Downtown');
  });

  it('keeps datamall availability for standalone datamall carparks', () => {
    const datamall: DatamallResult = {
      records: [datamallRecord('URA-X2', 1.35, 103.9)],
      availability: { 'URA-X2': { C: { available: 7, total: null } } },
      agencies: { 'URA-X2': { agency: 'URA', area: '', development: 'Some Development' } },
    };

    const merged = mergeAll([], {}, datamall, [], {}, {}, [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].availability['C']).toEqual({ available: 7, total: null });
  });
});

describe('mergeAll availability overwrites', () => {
  it('does not clobber a live available count with a totals-only entry', () => {
    const datamall: DatamallResult = {
      records: [],
      availability: { ACB: { C: { available: 42, total: null } } },
      agencies: {},
    };
    const parkDump = { P1: { availability: { C: { available: null, total: 100 } }, agency: 'HDB' } };

    const merged = mergeAll(
      [govRecord('ACB', 1.3, 103.8)], {}, datamall,
      [parkaholicRecord('P1', 1.3001, 103.8001)], parkDump, {}, [], [],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].availability['C']).toEqual({ available: 42, total: 100 });
  });

  it('does not share availability entry objects between source input and merged output', () => {
    const entry = { C: { available: 5, total: 50 } };
    const merged = mergeAll([govRecord('ACB', 1.3, 103.8)], { ACB: entry }, emptyDatamall, [], {}, {}, [], []);

    merged[0].availability['C'].available = 0;
    expect(entry.C.available).toBe(5);
  });
});

describe('buildSourceIdIndex and resolveCarparkId', () => {
  const index = buildSourceIdIndex([
    { id: 'CR6', sourceIds: { parkaholic: 'N0012', gov: 'CR6' } },
    { id: 'LTA-27', sourceIds: { datamall: 'LTA-52' } },
    { id: 'PLAIN', sourceIds: null },
  ]);

  it('maps a source-specific id to the merged carpark id', () => {
    expect(resolveCarparkId(index, 'parkaholic', 'N0012')).toBe('CR6');
    expect(resolveCarparkId(index, 'datamall', 'LTA-52')).toBe('LTA-27');
  });

  it('falls back to the raw id when no mapping exists', () => {
    expect(resolveCarparkId(index, 'parkaholic', 'Z9999')).toBe('Z9999');
    expect(resolveCarparkId(index, 'gov', 'CR6')).toBe('CR6');
  });
});

describe('planAvailabilityWrite', () => {
  it('skips writes that carry no data', () => {
    expect(planAvailabilityWrite({ available: 10, total: 50 }, { available: null, total: null })).toBeNull();
    expect(planAvailabilityWrite(null, { available: null, total: null })).toBeNull();
  });

  it('preserves the live available count when only a total arrives', () => {
    expect(planAvailabilityWrite({ available: 10, total: null }, { available: null, total: 80 }))
      .toEqual({ available: 10, total: 80 });
  });

  it('skips a totals-only write when the total is unchanged', () => {
    expect(planAvailabilityWrite({ available: 10, total: 80 }, { available: null, total: 80 })).toBeNull();
  });

  it('creates rows for carparks that gained live data between merges', () => {
    expect(planAvailabilityWrite(null, { available: 33, total: null })).toEqual({ available: 33, total: 33 });
    expect(planAvailabilityWrite(null, { available: 33, total: 120 })).toEqual({ available: 33, total: 120 });
  });

  it('grows an inferred total to the highest observed available count', () => {
    expect(planAvailabilityWrite({ available: 10, total: 20 }, { available: 30, total: null }))
      .toEqual({ available: 30, total: 30 });
    expect(planAvailabilityWrite({ available: 10, total: 80 }, { available: 30, total: null }))
      .toEqual({ available: 30, total: 80 });
  });

  it('prefers an explicit incoming total over inference', () => {
    expect(planAvailabilityWrite({ available: 10, total: 20 }, { available: 5, total: 60 }))
      .toEqual({ available: 5, total: 60 });
  });
});
