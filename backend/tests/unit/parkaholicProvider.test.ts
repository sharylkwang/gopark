import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockGet = jest.fn<any>();
const mockPost = jest.fn<any>();

jest.unstable_mockModule('../../src/lib/parkaholicClient', () => ({
  default: { get: mockGet, post: mockPost },
}));

const { fetchLocations, fetchDump } = await import('../../src/cron/providers/parkaholic');

describe('fetchLocations', () => {
  beforeEach(() => mockGet.mockReset());

  it('keeps entries inside the Singapore bounding box', async () => {
    mockGet.mockResolvedValue({ data: { A0024: { Development: 'ADAM ROAD FOOD CENTRE', Location: '1.3241 103.8138', LotType: ['Car', 'Motorcycle'], Area: 'Bukit Timah' } } });
    const out = await fetchLocations();
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('A0024');
    expect(out[0].lat).toBeCloseTo(1.3241);
    expect(out[0].lot_types).toBe('Car, Motorcycle');
    expect(out[0].metadata.area).toBe('Bukit Timah');
  });

  it('drops entries with out-of-range coordinates', async () => {
    mockGet.mockResolvedValue({ data: { KL1: { Development: 'Kuala Lumpur CP', Location: '3.1390 101.6869', LotType: ['Car'] } } });
    expect(await fetchLocations()).toHaveLength(0);
  });

  it('skips malformed Location strings', async () => {
    mockGet.mockResolvedValue({ data: {
      B1: { Development: 'No coords', Location: '', LotType: ['Car'] },
      B2: { Development: 'One part', Location: '1.3241', LotType: ['Car'] },
      B3: { Development: 'Not numbers', Location: 'abc def', LotType: ['Car'] },
    } });
    expect(await fetchLocations()).toHaveLength(0);
  });

  it('falls back to the id when Development is missing', async () => {
    mockGet.mockResolvedValue({ data: { C9: { Location: '1.30 103.85', LotType: [] } } });
    const out = await fetchLocations();
    expect(out[0].name).toBe('C9');
  });
});

describe('fetchDump', () => {
  beforeEach(() => mockGet.mockReset());

  it('groups lot types under one carpark and parses counts', async () => {
    mockGet.mockResolvedValue({ data: { resp: {
      r1: { CarParkID: '3', LotType: 'C', AvailableLots: 219, TotalLots: 960, Agency: 'LTA' },
      r2: { CarParkID: '3', LotType: 'Y', AvailableLots: '12', TotalLots: '30', Agency: 'LTA' },
    } } });
    const out = await fetchDump();
    expect(out['3'].availability.C).toEqual({ available: 219, total: 960 });
    expect(out['3'].availability.Y).toEqual({ available: 12, total: 30 });
    expect(out['3'].agency).toBe('LTA');
  });

  it('defaults unknown lot types to C', async () => {
    mockGet.mockResolvedValue({ data: { resp: { r1: { CarParkID: 'X1', LotType: 'Z', AvailableLots: 5, TotalLots: 10 } } } });
    const out = await fetchDump();
    expect(out['X1'].availability.C).toEqual({ available: 5, total: 10 });
  });

  it('keeps null counts when lots are missing', async () => {
    mockGet.mockResolvedValue({ data: { resp: { r1: { CarParkID: 'X2', LotType: 'C' } } } });
    const out = await fetchDump();
    expect(out['X2'].availability.C).toEqual({ available: null, total: null });
  });

  it('returns an empty map when the response has no resp field', async () => {
    mockGet.mockResolvedValue({ data: {} });
    expect(await fetchDump()).toEqual({});
  });
});
