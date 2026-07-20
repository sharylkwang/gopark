const SG_PUBLIC_HOLIDAYS: Record<string, string> = {
  '2025-01-01': "New Year's Day",
  '2025-01-29': 'Chinese New Year',
  '2025-01-30': 'Chinese New Year',
  '2025-03-31': 'Hari Raya Puasa',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Labour Day',
  '2025-05-12': 'Vesak Day',
  '2025-06-07': 'Hari Raya Haji',
  '2025-08-09': 'National Day',
  '2025-10-20': 'Deepavali',
  '2025-12-25': 'Christmas Day',
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year',
  '2026-02-18': 'Chinese New Year',
  '2026-03-21': 'Hari Raya Puasa',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Labour Day',
  '2026-05-27': 'Hari Raya Haji',
  '2026-05-31': 'Vesak Day',
  '2026-08-09': 'National Day',
  '2026-11-08': 'Deepavali',
  '2026-12-25': 'Christmas Day',
};

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function publicHolidayName(date: Date): string | null {
  return SG_PUBLIC_HOLIDAYS[isoDate(date)] ?? null;
}

export function isPublicHoliday(date: Date): boolean {
  return isoDate(date) in SG_PUBLIC_HOLIDAYS;
}

export function sameDateLastYear(date: Date): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - 1);
  return d;
}
