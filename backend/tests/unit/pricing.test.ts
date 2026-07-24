import { describe, it, expect } from '@jest/globals';
import { estimateCost, type PricingRate } from '../../src/lib/pricing';

const rate = (o: Partial<PricingRate>): PricingRate => ({
  amount: 0, durationMins: null, unit: 'flat', vehicleType: 'C',
  periodStart: null, periodEnd: null, isFirst: false, dayType: 'all', ...o,
});

const weekday9am = new Date('2026-07-20T09:00:00');

describe('estimateCost', () => {
  it('charges per-30-min blocks, rounding up a partial block', () => {
    const rates = [rate({ amount: 1.2, durationMins: 30 })];
    expect(estimateCost(rates, 60, 'C', weekday9am)).toBe(2.4);
    expect(estimateCost(rates, 45, 'C', weekday9am)).toBe(2.4);
    expect(estimateCost(rates, 31, 'C', weekday9am)).toBe(2.4);
  });

  it('applies a first-block rate then the subsequent rate', () => {
    const rates = [
      rate({ amount: 2, durationMins: 60, isFirst: true }),
      rate({ amount: 1, durationMins: 30 }),
    ];
    expect(estimateCost(rates, 120, 'C', weekday9am)).toBe(4);
  });

  it('returns null when the vehicle type has no rates', () => {
    const rates = [rate({ amount: 1.2, durationMins: 30, vehicleType: 'C' })];
    expect(estimateCost(rates, 60, 'Y', weekday9am)).toBeNull();
  });

  it('crosses a time-of-day boundary into the evening rate', () => {
    const rates = [
      rate({ amount: 1, durationMins: 30, periodStart: '07:00', periodEnd: '17:00' }),
      rate({ amount: 3, durationMins: 30, periodStart: '17:00', periodEnd: '23:59' }),
    ];
    const at1630 = new Date('2026-07-20T16:30:00');
    expect(estimateCost(rates, 60, 'C', at1630)).toBe(4);
  });

  it('is time-sensitive: the same duration costs more starting in the evening', () => {
    const rates = [
      rate({ amount: 1, durationMins: 30, periodStart: '07:00', periodEnd: '17:00' }),
      rate({ amount: 3, durationMins: 30, periodStart: '17:00', periodEnd: '23:59' }),
    ];
    const day = estimateCost(rates, 60, 'C', new Date('2026-07-20T10:00:00'));
    const evening = estimateCost(rates, 60, 'C', new Date('2026-07-20T18:00:00'));
    expect(evening!).toBeGreaterThan(day!);
  });

  it('uses a per-day cap for long stays', () => {
    const rates = [rate({ amount: 20, durationMins: 1440 })];
    expect(estimateCost(rates, 1440, 'C', weekday9am)).toBe(20);
    expect(estimateCost(rates, 2880, 'C', weekday9am)).toBe(40);
  });

  it('returns null for non-positive duration or empty rates', () => {
    expect(estimateCost([], 60, 'C', weekday9am)).toBeNull();
    expect(estimateCost([rate({ amount: 1, durationMins: 30 })], 0, 'C', weekday9am)).toBeNull();
  });
});

describe('estimateCost robustness against dirty rate data', () => {
  it('ignores rates with NaN or negative amounts', () => {
    const rates = [
      rate({ amount: NaN, durationMins: 30 }),
      rate({ amount: -5, durationMins: 30 }),
      rate({ amount: 1.2, durationMins: 30 }),
    ];
    expect(estimateCost(rates, 60, 'C', weekday9am)).toBe(2.4);
  });

  it('treats a malformed time string as an unbounded period rather than dropping the rate', () => {
    const rates = [rate({ amount: 1.2, durationMins: 30, periodStart: 'abc', periodEnd: '25:99' })];
    expect(estimateCost(rates, 60, 'C', weekday9am)).toBe(2.4);
  });

  it('returns null when every rate for the vehicle is unusable', () => {
    const rates = [rate({ amount: NaN, durationMins: 30 }), rate({ amount: 2, durationMins: 0 })];
    expect(estimateCost(rates, 60, 'C', weekday9am)).toBeNull();
  });

  it('never returns a NaN cost', () => {
    const rates = [rate({ amount: Infinity, durationMins: 30 }), rate({ amount: 1, durationMins: 30 })];
    const cost = estimateCost(rates, 120, 'C', weekday9am);
    expect(cost == null || Number.isFinite(cost)).toBe(true);
  });
});
