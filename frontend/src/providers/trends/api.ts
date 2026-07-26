export interface CarparkTrend {
  carparkId: string;
  weekday: Record<string, number[]> | null;
  today: number[];
  todaySource: 'observed' | 'holiday-last-year' | 'own-average' | 'default';
  isHoliday: boolean;
  holidayName: string | null;
  sampleCount: number;
  computedAt: string | null;
}

export async function fetchTrend(id: string): Promise<CarparkTrend | null> {
  try {
    const res = await fetch(`/api/carparks/${encodeURIComponent(id)}/trend`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
