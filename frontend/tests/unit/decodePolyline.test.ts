import { describe, expect, test } from '@jest/globals';
import { decodePolyline } from '../../src/utils/decodePolyline';

describe('decodePolyline', () => {
  test('decodes the documented Google reference polyline', () => {
    const out = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(out).toHaveLength(3);
    expect(out[0][0]).toBeCloseTo(38.5, 5);
    expect(out[0][1]).toBeCloseTo(-120.2, 5);
    expect(out[1][0]).toBeCloseTo(40.7, 5);
    expect(out[1][1]).toBeCloseTo(-120.95, 5);
    expect(out[2][0]).toBeCloseTo(43.252, 5);
    expect(out[2][1]).toBeCloseTo(-126.453, 5);
  });

  test('decodes a single point', () => {
    const out = decodePolyline('_p~iF~ps|U');
    expect(out).toEqual([[38.5, -120.2]]);
  });

  test('returns an empty array for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  test('accumulates deltas relative to the previous point', () => {
    const out = decodePolyline('_p~iF~ps|U_ulLnnqC');
    expect(out[1][0]).toBeCloseTo(out[0][0] + 2.2, 5);
    expect(out[1][1]).toBeCloseTo(out[0][1] - 0.75, 5);
  });
});
