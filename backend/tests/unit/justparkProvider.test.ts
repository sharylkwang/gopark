import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { JustParkSite } from '../../src/lib/justparkClient.js';

const mockFetchSites = jest.fn<any>();
const mockFetchAllRates = jest.fn<any>();
const mockGeocode = jest.fn<any>();

jest.unstable_mockModule('../../src/lib/justparkClient', () => ({
  fetchSites: mockFetchSites,
  fetchAllRates: mockFetchAllRates,
}));

jest.unstable_mockModule('../../src/cron/scraper/geocode', () => ({
  geocode: mockGeocode,
}));

jest.unstable_mockModule('../../src/lib/logger', () => ({
  default: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const { fetchJustpark, fetchJustparkAvailability } = await import('../../src/cron/providers/justpark');

const site = (over: Partial<JustParkSite> = {}): JustParkSite => ({
  SiteCode: 'RCS', SiteDesc: 'Raffles City', BusinessUnit: '1', BusinessUnitDesc: 'Malls',
  LotBalance: '219', LotTotal: '960', Available: true, IsFull: false, ...over,
});

beforeEach(() => {
  mockFetchSites.mockReset();
  mockFetchAllRates.mockReset();
  mockGeocode.mockReset();
  mockFetchAllRates.mockResolvedValue({});
  mockGeocode.mockResolvedValue({ lat: 1.2938, lng: 103.8532 });
});

describe('fetchJustpark', () => {
  it('prefixes ids with CLND- and parses lot counts', async () => {
    mockFetchSites.mockResolvedValue([site()]);
    const out = await fetchJustpark();
    expect(out.records).toHaveLength(1);
    expect(out.records[0].id).toBe('CLND-RCS');
    expect(out.records[0].agency).toBe('CapitaLand');
    expect(out.records[0].availability.C).toEqual({ available: 219, total: 960 });
  });

  it('treats an NA lot balance as unknown', async () => {
    mockFetchSites.mockResolvedValue([site({ SiteCode: 'NAX', SiteDesc: 'Funan NA Mall', LotBalance: 'NA', LotTotal: null })]);
    const out = await fetchJustpark();
    expect(out.records[0].availability.C).toEqual({ available: null, total: null });
  });

  it('geocodes sites shipped at 0,0 so the geofence keeps them', async () => {
    mockFetchSites.mockResolvedValue([site({ SiteCode: 'GEO', SiteDesc: 'Plaza Geocode Test' })]);
    const out = await fetchJustpark();
    expect(mockGeocode).toHaveBeenCalledWith('Plaza Geocode Test, Singapore');
    expect(out.records[0].lat).toBeCloseTo(1.2938);
    expect(out.records[0].lng).toBeCloseTo(103.8532);
  });

  it('keeps the raw rate text in metadata for the parser', async () => {
    mockFetchSites.mockResolvedValue([site({ SiteCode: 'RTX', SiteDesc: 'Rate Text Mall' })]);
    mockFetchAllRates.mockResolvedValue({ RTX: '$1.50 per hour' });
    const out = await fetchJustpark();
    expect(out.records[0].metadata.rate_text).toBe('$1.50 per hour');
  });
});

describe('fetchJustparkAvailability', () => {
  it('keys live availability by the prefixed id', async () => {
    mockFetchSites.mockResolvedValue([site({ SiteCode: 'AV1', SiteDesc: 'Avail Mall', LotBalance: '42', LotTotal: '100' })]);
    const out = await fetchJustparkAvailability();
    expect(out['CLND-AV1'].C).toEqual({ available: 42, total: 100 });
  });
});
