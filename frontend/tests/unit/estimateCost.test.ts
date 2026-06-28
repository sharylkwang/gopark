import { describe, expect, test } from '@jest/globals';
import { estimateCost } from '../../src/utils/estimateCost';

interface CarparkRate {
  amount: number;
  durationMins: number | null;
  unit: string;
  vehicleType: string;
  periodStart: string | null;
  periodEnd: string | null;
  isFirst: boolean;
  dayType: string;
  sources: string[];
  confirmedBy: number;
}

function makeRate(overrides: Partial<CarparkRate> = {}): CarparkRate {
  return {
    amount: 0.60,
    durationMins: 30,
    unit: 'per_entry',
    vehicleType: 'C',
    periodStart: null,
    periodEnd: null,
    isFirst: false,
    dayType: 'all',
    sources: ['test'],
    confirmedBy: 1,
    ...overrides,
  };
}

const WEDNESDAY_9AM = new Date('2026-06-24T09:00:00');
const SATURDAY_10AM = new Date('2026-06-27T10:00:00');
const SUNDAY_10AM = new Date('2026-06-28T10:00:00');
const WEDNESDAY_6PM = new Date('2026-06-24T18:00:00');

describe('estimateCost', () => {
  describe('null returns', () => {
    test('returns null for empty rates array', () => {
      expect(estimateCost([], 1, 'C', WEDNESDAY_9AM)).toBeNull();
    });

    test('returns null for zero duration', () => {
      const rates = [makeRate()];
      expect(estimateCost(rates, 0, 'C', WEDNESDAY_9AM)).toBeNull();
    });

    test('returns null for negative duration', () => {
      const rates = [makeRate()];
      expect(estimateCost(rates, -1, 'C', WEDNESDAY_9AM)).toBeNull();
    });

    test('returns null for non-matching vehicle type', () => {
      const rates = [makeRate({ vehicleType: 'C' })];
      expect(estimateCost(rates, 1, 'M', WEDNESDAY_9AM)).toBeNull();
    });

    test('returns null for undefined rates', () => {
      expect(estimateCost(undefined as any, 1, 'C', WEDNESDAY_9AM)).toBeNull();
    });
  });

  describe('simple flat rate calculation', () => {
    test('calculates cost for 1 hour at $0.60 per 30 min', () => {
      const rates = [makeRate({ amount: 0.60, durationMins: 30 })];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });

    test('calculates cost for 2 hours at $0.60 per 30 min', () => {
      const rates = [makeRate({ amount: 0.60, durationMins: 30 })];
      const result = estimateCost(rates, 2, 'C', WEDNESDAY_9AM);
      expect(result).toBe(2.40);
    });

    test('rounds up partial blocks', () => {
      const rates = [makeRate({ amount: 0.60, durationMins: 30 })];
      const result = estimateCost(rates, 0.75, 'C', WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });

    test('calculates cost for 30 minutes at $0.60 per 30 min', () => {
      const rates = [makeRate({ amount: 0.60, durationMins: 30 })];
      const result = estimateCost(rates, 0.5, 'C', WEDNESDAY_9AM);
      expect(result).toBe(0.60);
    });
  });

  describe('per-day rate for 24h+ parking', () => {
    test('applies per-day rate for exactly 24 hours', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30 }),
        makeRate({ amount: 10.00, durationMins: 1440 }),
      ];
      const result = estimateCost(rates, 24, 'C', WEDNESDAY_9AM);
      expect(result).toBe(10.00);
    });

    test('applies per-day rate for 48 hours as 2 days', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30 }),
        makeRate({ amount: 10.00, durationMins: 1440 }),
      ];
      const result = estimateCost(rates, 48, 'C', WEDNESDAY_9AM);
      expect(result).toBe(20.00);
    });

    test('applies per-day rate for 36 hours rounded up to 2 days', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30 }),
        makeRate({ amount: 10.00, durationMins: 1440 }),
      ];
      const result = estimateCost(rates, 36, 'C', WEDNESDAY_9AM);
      expect(result).toBe(20.00);
    });

    test('does not apply per-day multiplier for less than 24 hours', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30 }),
      ];
      const result = estimateCost(rates, 2, 'C', WEDNESDAY_9AM);
      expect(result).toBe(2.40);
    });
  });

  describe('first rate plus subsequent rate', () => {
    test('applies first rate then subsequent rate', () => {
      const rates = [
        makeRate({ amount: 1.20, durationMins: 30, isFirst: true }),
        makeRate({ amount: 0.60, durationMins: 30, isFirst: false }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBeCloseTo(1.80);
    });

    test('uses only first rate when duration fits within first block', () => {
      const rates = [
        makeRate({ amount: 1.20, durationMins: 60, isFirst: true }),
        makeRate({ amount: 0.60, durationMins: 30, isFirst: false }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });

    test('calculates multiple subsequent blocks after first rate', () => {
      const rates = [
        makeRate({ amount: 1.20, durationMins: 30, isFirst: true }),
        makeRate({ amount: 0.60, durationMins: 30, isFirst: false }),
      ];
      const result = estimateCost(rates, 2, 'C', WEDNESDAY_9AM);
      expect(result).toBeCloseTo(3.00);
    });
  });

  describe('day type rate selection', () => {
    test('uses weekday rate on wednesday', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, dayType: 'weekday' }),
        makeRate({ amount: 1.00, durationMins: 30, dayType: 'saturday' }),
        makeRate({ amount: 1.20, durationMins: 30, dayType: 'sunday' }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });

    test('uses saturday rate on saturday', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, dayType: 'weekday' }),
        makeRate({ amount: 1.00, durationMins: 30, dayType: 'saturday' }),
        makeRate({ amount: 1.20, durationMins: 30, dayType: 'sunday' }),
      ];
      const result = estimateCost(rates, 1, 'C', SATURDAY_10AM);
      expect(result).toBe(2.00);
    });

    test('uses sunday rate on sunday', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, dayType: 'weekday' }),
        makeRate({ amount: 1.00, durationMins: 30, dayType: 'saturday' }),
        makeRate({ amount: 1.20, durationMins: 30, dayType: 'sunday' }),
      ];
      const result = estimateCost(rates, 1, 'C', SUNDAY_10AM);
      expect(result).toBe(2.40);
    });

    test('uses all day type rate when no specific day type matches', () => {
      const rates = [
        makeRate({ amount: 0.80, durationMins: 30, dayType: 'all' }),
      ];
      const resultWeekday = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      const resultSaturday = estimateCost(rates, 1, 'C', SATURDAY_10AM);
      const resultSunday = estimateCost(rates, 1, 'C', SUNDAY_10AM);
      expect(resultWeekday).toBe(1.60);
      expect(resultSaturday).toBe(1.60);
      expect(resultSunday).toBe(1.60);
    });
  });

  describe('evening rate', () => {
    test('uses weekday_eve rate after 5pm on weekday', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, dayType: 'weekday' }),
        makeRate({ amount: 0.40, durationMins: 30, dayType: 'weekday_eve' }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_6PM);
      expect(result).not.toBeNull();
      expect(result).toBeGreaterThan(0);
    });

    test('does not use weekday_eve rate before 5pm on weekday', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, dayType: 'weekday' }),
        makeRate({ amount: 0.40, durationMins: 30, dayType: 'weekday_eve' }),
      ];
      const resultMorning = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(resultMorning).toBe(1.20);
    });

    test('does not use weekday_eve rate on weekends', () => {
      const rates = [
        makeRate({ amount: 1.00, durationMins: 30, dayType: 'saturday' }),
        makeRate({ amount: 0.40, durationMins: 30, dayType: 'weekday_eve' }),
      ];
      const saturdayEvening = new Date('2026-06-27T18:00:00');
      const result = estimateCost(rates, 1, 'C', saturdayEvening);
      expect(result).toBe(2.00);
    });
  });

  describe('vehicle type filtering', () => {
    test('uses car rates for vehicle type C', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, vehicleType: 'C' }),
        makeRate({ amount: 0.30, durationMins: 30, vehicleType: 'M' }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });

    test('uses motorcycle rates for vehicle type M', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, vehicleType: 'C' }),
        makeRate({ amount: 0.30, durationMins: 30, vehicleType: 'M' }),
      ];
      const result = estimateCost(rates, 1, 'M', WEDNESDAY_9AM);
      expect(result).toBe(0.60);
    });

    test('defaults to vehicle type C when not specified', () => {
      const rates = [
        makeRate({ amount: 0.60, durationMins: 30, vehicleType: 'C' }),
        makeRate({ amount: 0.30, durationMins: 30, vehicleType: 'M' }),
      ];
      const result = estimateCost(rates, 1, undefined as any, WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });
  });

  describe('time period filtering', () => {
    test('matches rate within period window', () => {
      const rates = [
        makeRate({
          amount: 0.60,
          durationMins: 30,
          periodStart: '07:00',
          periodEnd: '17:00',
        }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBe(1.20);
    });

    test('applies rate with no period restriction at any time', () => {
      const rates = [
        makeRate({
          amount: 0.60,
          durationMins: 30,
          periodStart: null,
          periodEnd: null,
        }),
      ];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_6PM);
      expect(result).toBe(1.20);
    });
  });

  describe('edge cases', () => {
    test('handles very short duration of 15 minutes', () => {
      const rates = [makeRate({ amount: 0.60, durationMins: 30 })];
      const result = estimateCost(rates, 0.25, 'C', WEDNESDAY_9AM);
      expect(result).toBe(0.60);
    });

    test('handles fractional hour durations', () => {
      const rates = [makeRate({ amount: 1.00, durationMins: 15 })];
      const result = estimateCost(rates, 1, 'C', WEDNESDAY_9AM);
      expect(result).toBe(4.00);
    });
  });
});
