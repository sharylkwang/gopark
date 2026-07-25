import { describe, it, expect } from '@jest/globals';
import { collapsePrefixTwins } from '../../src/cron/pipeline/merge';
import type { MergedCarpark } from '../../src/cron/pipeline/types';

const cp = (id: string, over: Partial<MergedCarpark> = {}): MergedCarpark => ({
  id, name: id, lat: 1.30, lng: 103.85, address: '', agency: '', sources: [], source_ids: {},
  source_count: 0, rates: [], availability: {}, lot_types: '', metadata: {}, last_updated: '', ...over,
});

describe('collapsePrefixTwins', () => {
  it('folds a URA- twin into the bare id and drops the duplicate', () => {
    const map: Record<string, MergedCarpark> = {
      'J0122': cp('J0122', { sources: ['parkaholic'], source_ids: { parkaholic: 'J0122' }, availability: { C: { available: null, total: 100 } } }),
      'URA-J0122': cp('URA-J0122', { sources: ['datamall'], source_ids: { datamall: 'URA-J0122' }, availability: { C: { available: 42, total: null }, Y: { available: 5, total: 10 } } }),
    };
    const n = collapsePrefixTwins(map);
    expect(n).toBe(1);
    expect(map['URA-J0122']).toBeUndefined();
    const survivor = map['J0122'];
    expect(survivor.sources.sort()).toEqual(['datamall', 'parkaholic']);
    expect(survivor.source_ids).toEqual({ parkaholic: 'J0122', datamall: 'URA-J0122' });
    expect(survivor.availability.C).toEqual({ available: 42, total: 100 });
    expect(survivor.availability.Y).toEqual({ available: 5, total: 10 });
  });

  it('does not merge when the coordinates differ (id collision, different place)', () => {
    const map: Record<string, MergedCarpark> = {
      'X1': cp('X1', { lat: 1.30, lng: 103.85 }),
      'URA-X1': cp('URA-X1', { lat: 1.40, lng: 103.99 }),
    };
    expect(collapsePrefixTwins(map)).toBe(0);
    expect(map['URA-X1']).toBeDefined();
  });

  it('leaves a prefixed carpark with no bare twin untouched', () => {
    const map: Record<string, MergedCarpark> = { 'URA-Q0006': cp('URA-Q0006') };
    expect(collapsePrefixTwins(map)).toBe(0);
    expect(map['URA-Q0006']).toBeDefined();
  });
});
