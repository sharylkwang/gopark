import { fetchSites, fetchAllRates, type JustParkSite } from '../../lib/justparkClient.js';
import type { CarparkRecord, AvailabilityEntry, RateEntry } from '../pipeline/types.js';

export interface JustParkResult {
  records: CarparkRecord[];
  availability: Record<string, Record<string, AvailabilityEntry>>;
}

function parseSiteCode(site: JustParkSite): string {
  return `CLND-${site.SiteCode}`;
}

function parseRateText(text: string): RateEntry[] {
  const rates: RateEntry[] = [];
  if (!text) return rates;

  const sections = text.split(/\n\n+/);
  let vehicleType = 'C';

  for (const section of sections) {
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const header = lines[0].toLowerCase();
    if (header.startsWith('car')) vehicleType = 'C';
    else if (header.startsWith('motorcycle')) vehicleType = 'Y';
    else if (header.match(/lorry|heavy|hv|loading/i)) vehicleType = 'H';

    let dayType = 'all';
    for (const line of lines) {
      const dayMatch = line.match(/^(mon|tue|wed|thu|fri|sat|sun|daily|eve|public)/i);
      if (dayMatch) {
        const lower = line.toLowerCase();
        if (lower.includes('sun') && lower.includes('ph') && !lower.includes('mon') && !lower.includes('sat')) dayType = 'sun_ph';
        else if (lower.includes('sat') && (lower.includes('sun') || lower.includes('ph'))) dayType = 'weekend';
        else if (lower.includes('mon') && lower.includes('fri')) dayType = lower.includes('sat') ? 'all' : 'weekday';
        else if (lower.includes('eve') && lower.includes('ph')) dayType = 'eve_ph';
        else if (lower.includes('ph')) dayType = 'ph';
        else if (lower.includes('sat')) dayType = 'saturday';
        else if (lower.includes('sun')) dayType = 'sunday';
        continue;
      }

      const timeMatch = line.match(/(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)/i);
      const periodStart = timeMatch ? normalizeTime(timeMatch[1]) : null;
      const periodEnd = timeMatch ? normalizeTime(timeMatch[2]) : null;

      const perEntry = line.match(/\$(\d+\.?\d*)\s*per\s*entry/i);
      if (perEntry) {
        rates.push({
          amount: parseFloat(perEntry[1]),
          duration_mins: null,
          unit: 'per_entry',
          vehicle_type: vehicleType,
          period_start: periodStart,
          period_end: periodEnd,
          is_first: false,
          day_type: dayType,
          source: 'justpark',
        });
        continue;
      }

      const firstHour = line.match(/1st\s*hour\s*@?\s*\$(\d+\.?\d*)/i);
      if (firstHour) {
        rates.push({
          amount: parseFloat(firstHour[1]),
          duration_mins: 60,
          unit: 'per_60min',
          vehicle_type: vehicleType,
          period_start: periodStart,
          period_end: periodEnd,
          is_first: true,
          day_type: dayType,
          source: 'justpark',
        });
        continue;
      }

      const subseq = line.match(/\$(\d+\.?\d*)\s*(?:for\s+)?(?:subsequent|sub)\s*(\d+)\s*min/i);
      if (subseq) {
        const mins = parseInt(subseq[2]);
        rates.push({
          amount: parseFloat(subseq[1]),
          duration_mins: mins,
          unit: `per_${mins}min`,
          vehicle_type: vehicleType,
          period_start: periodStart,
          period_end: periodEnd,
          is_first: false,
          day_type: dayType,
          source: 'justpark',
        });
        continue;
      }

      const every = line.match(/every\s*(\d+)\s*min[s]?\s*@?\s*\$(\d+\.?\d*)/i);
      if (every) {
        const mins = parseInt(every[1]);
        rates.push({
          amount: parseFloat(every[2]),
          duration_mins: mins,
          unit: `per_${mins}min`,
          vehicle_type: vehicleType,
          period_start: periodStart,
          period_end: periodEnd,
          is_first: false,
          day_type: dayType,
          source: 'justpark',
        });
        continue;
      }

      const generic = line.match(/\$(\d+\.?\d*)\s*[-–]\s*(?:for\s+)?(?:first|1st)?\s*(?:hour|hr)/i);
      if (generic) {
        rates.push({
          amount: parseFloat(generic[1]),
          duration_mins: 60,
          unit: 'per_60min',
          vehicle_type: vehicleType,
          period_start: periodStart,
          period_end: periodEnd,
          is_first: line.toLowerCase().includes('first') || line.toLowerCase().includes('1st'),
          day_type: dayType,
          source: 'justpark',
        });
      }
    }
  }

  return rates;
}

function normalizeTime(t: string): string {
  const cleaned = t.replace(/\./g, ':').trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return cleaned;
  let h = parseInt(match[1]);
  const m = match[2];
  const period = match[3];
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

export async function fetchJustpark(): Promise<JustParkResult> {
  const sites = await fetchSites();
  const rateTexts = await fetchAllRates(sites);

  const records: CarparkRecord[] = [];
  const availability: Record<string, Record<string, AvailabilityEntry>> = {};

  for (const site of sites) {
    const id = parseSiteCode(site);
    const balance = site.LotBalance === 'NA' ? null : parseInt(site.LotBalance) || 0;
    const total = site.LotTotal ? parseInt(site.LotTotal) || null : null;

    availability[id] = { C: { available: balance, total } };

    const rateText = rateTexts[site.SiteCode] ?? '';
    const rates = parseRateText(rateText);

    records.push({
      id,
      name: site.SiteDesc,
      lat: 0,
      lng: 0,
      address: site.SiteDesc,
      agency: 'CapitaLand',
      source: 'justpark',
      rates,
      availability: { C: { available: balance, total } },
      lot_types: 'C',
      metadata: {
        justpark_code: site.SiteCode,
        business_unit: site.BusinessUnitDesc,
        rate_text: rateText,
      },
    });
  }

  return { records, availability };
}

export async function fetchJustparkAvailability(): Promise<Record<string, Record<string, AvailabilityEntry>>> {
  const sites = await fetchSites();
  const availability: Record<string, Record<string, AvailabilityEntry>> = {};

  for (const site of sites) {
    const id = parseSiteCode(site);
    const balance = site.LotBalance === 'NA' ? null : parseInt(site.LotBalance) || 0;
    const total = site.LotTotal ? parseInt(site.LotTotal) || null : null;
    availability[id] = { C: { available: balance, total } };
  }

  return availability;
}
