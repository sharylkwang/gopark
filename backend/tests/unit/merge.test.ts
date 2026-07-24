import { jest, describe, it, expect } from '@jest/globals';

jest.unstable_mockModule('../../src/lib/geofence', () => ({
  isInSingapore: () => true,
}));

const { mergeAll } = await import('../../src/cron/pipeline/merge');
import type { CarparkRecord, DatamallResult } from '../../src/cron/pipeline/types';

function govRecord(id: string, lat: number, lng: number): CarparkRecord {
  return {
    id, name: `Carpark ${id}`, lat, lng, address: `${id} street`,
    agency: 'HDB', source: 'gov', rates: [], availability: {}, lot_types: '', metadata: {},
  };
}

function datamallRecord(id: string, lat: number, lng: number): CarparkRecord {
  return {
    id, name: `DM ${id}`, lat, lng, address: `DM ${id}`,
    agency: 'URA', source: 'datamall', rates: [], availability: {}, lot_types: '',
    metadata: { agency: 'URA', raw_id: id.replace('URA-', '') },
  };
}

function emptyDatamall(): DatamallResult {
  return { records: [], availability: {}, agencies: {} };
}

describe('mergeAll datamall lot type handling', () => {
  it('keeps motorcycle availability when a datamall record merges into an existing carpark by proximity', () => {
    const datamall: DatamallResult = {
      records: [datamallRecord('URA-J0122', 1.31, 103.82)],
      availability: {
        'URA-J0122': {
          C: { available: 152, total: null },
          Y: { available: 11, total: null },
        },
      },
      agencies: { 'URA-J0122': { agency: 'URA', area: 'Jalan Kayu', development: '' } },
    };

    const merged = mergeAll([govRecord('HDB1', 1.31, 103.82)], {}, datamall, [], {}, {}, [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('HDB1');
    expect(merged[0].availability.C).toEqual({ available: 152, total: null });
    expect(merged[0].availability.Y).toEqual({ available: 11, total: null });
    expect(merged[0].lot_types).toContain('Motorcycle');
  });

  it('keeps all lot types for a standalone datamall carpark', () => {
    const datamall: DatamallResult = {
      records: [datamallRecord('LTA-52', 1.29, 103.85)],
      availability: {
        'LTA-52': {
          C: { available: 40, total: null },
          Y: { available: 5, total: null },
          H: { available: 2, total: null },
        },
      },
      agencies: { 'LTA-52': { agency: 'LTA', area: '', development: 'Orchard Central' } },
    };

    const merged = mergeAll([], {}, datamall, [], {}, {}, [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('LTA-52');
    expect(Object.keys(merged[0].availability).sort()).toEqual(['C', 'H', 'Y']);
    expect(merged[0].availability.Y).toEqual({ available: 5, total: null });
  });

  it('applies datamall availability keyed by a bare id to the matching gov carpark', () => {
    const datamall: DatamallResult = {
      records: [],
      availability: { HDB1: { Y: { available: 7, total: null } } },
      agencies: { HDB1: { agency: 'HDB', area: '', development: '' } },
    };

    const merged = mergeAll([govRecord('HDB1', 1.35, 103.75)], {}, datamall, [], {}, {}, [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].availability.Y).toEqual({ available: 7, total: null });
  });

  it('drops datamall availability with no matching carpark or record', () => {
    const datamall: DatamallResult = {
      records: [],
      availability: { GHOST: { C: { available: 1, total: null } } },
      agencies: {},
    };

    const merged = mergeAll([govRecord('HDB1', 1.35, 103.75)], {}, datamall, [], {}, {}, [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].availability.C).toBeUndefined();
  });
});
