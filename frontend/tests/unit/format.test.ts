import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  timeAgo,
  formatDuration,
  formatDistance,
  formatParkDuration,
  parseDurationSecs,
  totals,
} from '../../src/utils/format';

describe('timeAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-28T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns just now for less than 1 minute ago', () => {
    const thirtySecondsAgo = new Date('2026-06-28T11:59:30Z').toISOString();
    expect(timeAgo(thirtySecondsAgo)).toBe('just now');
  });

  test('returns just now for exactly now', () => {
    const now = new Date('2026-06-28T12:00:00Z').toISOString();
    expect(timeAgo(now)).toBe('just now');
  });

  test('returns minutes ago for 1 to 59 minutes', () => {
    const fiveMinutesAgo = new Date('2026-06-28T11:55:00Z').toISOString();
    expect(timeAgo(fiveMinutesAgo)).toBe('5m ago');
  });

  test('returns 1m ago at exactly 60 seconds', () => {
    const oneMinuteAgo = new Date('2026-06-28T11:59:00Z').toISOString();
    expect(timeAgo(oneMinuteAgo)).toBe('1m ago');
  });

  test('returns 59m ago at 59 minutes', () => {
    const fiftyNineMinutesAgo = new Date('2026-06-28T11:01:00Z').toISOString();
    expect(timeAgo(fiftyNineMinutesAgo)).toBe('59m ago');
  });

  test('returns hours ago for 1 to 23 hours', () => {
    const twoHoursAgo = new Date('2026-06-28T10:00:00Z').toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2h ago');
  });

  test('returns 1h ago at exactly 1 hour', () => {
    const oneHourAgo = new Date('2026-06-28T11:00:00Z').toISOString();
    expect(timeAgo(oneHourAgo)).toBe('1h ago');
  });

  test('returns formatted date for 24 hours or more', () => {
    const twoDaysAgo = new Date('2026-06-26T10:00:00Z').toISOString();
    const result = timeAgo(twoDaysAgo);
    expect(result).not.toContain('ago');
    expect(result).not.toBe('just now');
  });
});

describe('formatDuration', () => {
  test('returns less than 1 min for 0 seconds', () => {
    expect(formatDuration(0)).toBe('<1 min');
  });

  test('returns less than 1 min for 30 seconds', () => {
    expect(formatDuration(30)).toBe('<1 min');
  });

  test('returns less than 1 min for 59 seconds', () => {
    expect(formatDuration(59)).toBe('<1 min');
  });

  test('returns 1 min for exactly 60 seconds', () => {
    expect(formatDuration(60)).toBe('1 min');
  });

  test('returns 2 min for 90 seconds due to rounding', () => {
    expect(formatDuration(90)).toBe('2 min');
  });

  test('returns 5 min for 300 seconds', () => {
    expect(formatDuration(300)).toBe('5 min');
  });

  test('returns 60 min for 3600 seconds', () => {
    expect(formatDuration(3600)).toBe('60 min');
  });
});

describe('formatDistance', () => {
  test('returns meters for values under 1000', () => {
    expect(formatDistance(500)).toBe('500 m');
  });

  test('returns meters for 0', () => {
    expect(formatDistance(0)).toBe('0 m');
  });

  test('returns meters for 999', () => {
    expect(formatDistance(999)).toBe('999 m');
  });

  test('returns kilometers for exactly 1000 meters', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
  });

  test('returns kilometers with one decimal for 1500 meters', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });

  test('returns kilometers for large distances', () => {
    expect(formatDistance(10000)).toBe('10.0 km');
  });

  test('returns kilometers with truncated decimal for 2345 meters', () => {
    expect(formatDistance(2345)).toBe('2.3 km');
  });
});

describe('formatParkDuration', () => {
  test('returns minutes only for less than 1 hour', () => {
    expect(formatParkDuration(0.5)).toBe('30 mins');
  });

  test('returns 0 mins for 0 hours', () => {
    expect(formatParkDuration(0)).toBe('0 mins');
  });

  test('returns hours only for exact hours', () => {
    expect(formatParkDuration(1)).toBe('1h');
  });

  test('returns hours and minutes for 1.5 hours', () => {
    expect(formatParkDuration(1.5)).toBe('1h 30 mins');
  });

  test('returns hours only for 2 hours', () => {
    expect(formatParkDuration(2)).toBe('2h');
  });

  test('returns hours and minutes for 2.25 hours', () => {
    expect(formatParkDuration(2.25)).toBe('2h 15 mins');
  });

  test('returns 45 mins for 0.75 hours', () => {
    expect(formatParkDuration(0.75)).toBe('45 mins');
  });
});

describe('parseDurationSecs', () => {
  test('parses 300s correctly', () => {
    expect(parseDurationSecs('300s')).toBe(300);
  });

  test('parses 60s correctly', () => {
    expect(parseDurationSecs('60s')).toBe(60);
  });

  test('parses 0s correctly', () => {
    expect(parseDurationSecs('0s')).toBe(0);
  });

  test('returns 0 for invalid string', () => {
    expect(parseDurationSecs('abc')).toBe(0);
  });

  test('returns 0 for empty string', () => {
    expect(parseDurationSecs('')).toBe(0);
  });

  test('parses string without s suffix', () => {
    expect(parseDurationSecs('120')).toBe(120);
  });
});

describe('totals', () => {
  test('calculates single lot type correctly', () => {
    const result = totals({ C: { available: 50, total: 100 } });
    expect(result.available).toBe(50);
    expect(result.total).toBe(100);
    expect(result.pct).toBe(50);
  });

  test('aggregates multiple lot types', () => {
    const result = totals({
      C: { available: 30, total: 100 },
      M: { available: 10, total: 20 },
    });
    expect(result.available).toBe(40);
    expect(result.total).toBe(120);
    expect(result.pct).toBeCloseTo(33.33, 1);
  });

  test('treats null available as 0', () => {
    const result = totals({ C: { available: null, total: 100 } });
    expect(result.available).toBe(0);
    expect(result.total).toBe(100);
    expect(result.pct).toBe(0);
  });

  test('treats null total as 0', () => {
    const result = totals({ C: { available: 50, total: null } });
    expect(result.available).toBe(0);
    expect(result.total).toBe(0);
    expect(result.pct).toBe(0);
  });

  test('handles both null values', () => {
    const result = totals({ C: { available: null, total: null } });
    expect(result.available).toBe(0);
    expect(result.total).toBe(0);
    expect(result.pct).toBe(0);
  });

  test('returns zeros for empty object', () => {
    const result = totals({});
    expect(result.available).toBe(0);
    expect(result.total).toBe(0);
    expect(result.pct).toBe(0);
  });

  test('caps available at total when available exceeds total', () => {
    const result = totals({ C: { available: 150, total: 100 } });
    expect(result.available).toBe(100);
    expect(result.total).toBe(100);
    expect(result.pct).toBe(100);
  });

  test('caps percentage at 100', () => {
    const result = totals({
      C: { available: 80, total: 50 },
      M: { available: 20, total: 30 },
    });
    expect(result.pct).toBeLessThanOrEqual(100);
  });

  test('handles 100 percent availability', () => {
    const result = totals({ C: { available: 100, total: 100 } });
    expect(result.available).toBe(100);
    expect(result.total).toBe(100);
    expect(result.pct).toBe(100);
  });
});
