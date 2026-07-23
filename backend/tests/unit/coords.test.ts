import { describe, it, expect } from '@jest/globals';
import { isLatLng } from '../../src/lib/coords';

describe('isLatLng', () => {
  it('accepts the equator / prime meridian (lat or lng of exactly 0)', () => {
    expect(isLatLng({ lat: 0, lng: 0 })).toBe(true);
    expect(isLatLng({ lat: 0, lng: 103.8 })).toBe(true);
    expect(isLatLng({ lat: 1.29, lng: 0 })).toBe(true);
  });

  it('accepts a normal Singapore coordinate', () => {
    expect(isLatLng({ lat: 1.2953, lng: 103.8587 })).toBe(true);
  });

  it('rejects out-of-range values', () => {
    expect(isLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isLatLng({ lat: 0, lng: 181 })).toBe(false);
  });

  it('rejects non-numeric and missing coordinates', () => {
    expect(isLatLng({ lat: 'abc', lng: '103' })).toBe(false);
    expect(isLatLng({ lat: NaN, lng: 0 })).toBe(false);
    expect(isLatLng({ lat: 1.3 })).toBe(false);
    expect(isLatLng(null)).toBe(false);
    expect(isLatLng(undefined)).toBe(false);
  });
});
