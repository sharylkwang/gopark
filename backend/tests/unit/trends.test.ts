import { describe, it, expect } from '@jest/globals';
import { occupancyPct, buildWeekdayProfile, resolveTrend, defaultTrend, type Snapshot } from '../../src/cron/trends/aggregate';
import { isPublicHoliday, sameDateLastYear, publicHolidayName, isoDate } from '../../src/lib/holidays';

const snap = (iso: string, occ: number): Snapshot => ({ occupancyPct: occ, recordedAt: new Date(iso) });

describe('occupancyPct', () => {
  it('converts available/total into a used percentage', () => {
    expect(occupancyPct(0, 100)).toBe(100);
    expect(occupancyPct(100, 100)).toBe(0);
    expect(occupancyPct(25, 100)).toBe(75);
  });
  it('returns null for missing or zero-capacity data', () => {
    expect(occupancyPct(null, 100)).toBeNull();
    expect(occupancyPct(10, null)).toBeNull();
    expect(occupancyPct(10, 0)).toBeNull();
  });
});

describe('holidays', () => {
  it('recognises Singapore public holidays', () => {
    expect(isPublicHoliday(new Date('2026-08-09T10:00:00'))).toBe(true);
    expect(publicHolidayName(new Date('2026-08-09T10:00:00'))).toBe('National Day');
    expect(isPublicHoliday(new Date('2026-08-10T10:00:00'))).toBe(false);
  });
  it('maps a date to the same calendar date one year earlier', () => {
    expect(isoDate(sameDateLastYear(new Date('2026-08-09T00:00:00')))).toBe('2025-08-09');
  });
});

describe('buildWeekdayProfile', () => {
  it('averages occupancy per weekday and hour, returning 24 values per day', () => {
    const snaps = [snap('2026-07-06T09:00:00', 60), snap('2026-07-13T09:00:00', 80), snap('2026-07-20T09:00:00', 70)];
    const { weekday } = buildWeekdayProfile(snaps);
    expect(weekday[1]).toHaveLength(24);
    expect(weekday[1][9]).toBe(70);
  });
  it('fills hours without enough samples from the default curve', () => {
    const { weekday } = buildWeekdayProfile([snap('2026-07-06T09:00:00', 60)]);
    expect(weekday[1][3]).toBe(defaultTrend()[3]);
  });
});

describe('resolveTrend', () => {
  it('uses the observed weekday profile on a normal day with data', () => {
    const mondays = [6, 13, 20].flatMap(d =>
      Array.from({ length: 24 }, (_, h) => snap(`2026-07-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00`, 50)));
    const t = resolveTrend(mondays, new Date('2026-07-27T12:00:00'));
    expect(t.isHoliday).toBe(false);
    expect(t.todaySource).toBe('observed');
    expect(t.today[12]).toBe(50);
  });

  it('falls back to the default trend on a normal day with no data', () => {
    const t = resolveTrend([], new Date('2026-07-27T12:00:00'));
    expect(t.todaySource).toBe('default');
    expect(t.today).toEqual(defaultTrend());
  });

  it('uses the same date last year on a public holiday when that history exists', () => {
    const lastYearNationalDay = Array.from({ length: 24 }, (_, h) =>
      snap(`2025-08-09T${String(h).padStart(2, '0')}:00:00`, 15));
    const t = resolveTrend(lastYearNationalDay, new Date('2026-08-09T12:00:00'));
    expect(t.isHoliday).toBe(true);
    expect(t.todaySource).toBe('holiday-last-year');
    expect(t.today[12]).toBe(15);
  });

  it('falls back to default on a holiday with no matching last-year data', () => {
    const t = resolveTrend([snap('2026-07-06T09:00:00', 60)], new Date('2026-08-09T12:00:00'));
    expect(t.isHoliday).toBe(true);
    expect(t.todaySource).toBe('default');
    expect(t.today).toEqual(defaultTrend());
  });
});
