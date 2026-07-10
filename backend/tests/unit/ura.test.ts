import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockAxiosGet = jest.fn<(...args: unknown[]) => Promise<{ data: unknown }>>();

jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet },
}));

jest.unstable_mockModule('../../src/lib/logger', () => ({
  default: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const { svy21ToWgs84 } = await import('../../src/providers/ura/svy21');
const { resetTokenCache, isUraConfigured } = await import('../../src/providers/ura/token');
const { resetServiceCache } = await import('../../src/providers/ura/service');
const { default: uraRouter } = await import('../../src/providers/ura/router');

function createApp() {
  const app = express();
  app.use(uraRouter);
  return app;
}

const TOKEN_URL = 'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';
const DATA_URL = 'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1';

const tokenResponse = { Status: 'Success', Message: '', Result: 'daily-token-123' };

const availabilityResponse = {
  Status: 'Success',
  Message: '',
  Result: [
    {
      lotsAvailable: '2',
      lotType: 'C',
      carparkNo: 'A0004',
      geometries: [{ coordinates: '31045.6165, 31694.0055' }],
    },
    {
      lotsAvailable: '0',
      lotType: 'M',
      carparkNo: 'N0006',
      geometries: [{ coordinates: '28956.4609, 29088.2522' }],
    },
    {
      lotsAvailable: '5',
      lotType: 'C',
      carparkNo: 'BROKEN',
      geometries: [{ coordinates: 'not-a-coordinate' }],
    },
  ],
};

function mockUpstream() {
  mockAxiosGet.mockImplementation(async (...args: unknown[]) => {
    const url = args[0] as string;
    if (url === TOKEN_URL) return { data: tokenResponse };
    if (url === DATA_URL) return { data: availabilityResponse };
    throw new Error(`Unexpected URL: ${url}`);
  });
}

function tokenCallCount(): number {
  return mockAxiosGet.mock.calls.filter((call) => call[0] === TOKEN_URL).length;
}

describe('SVY21 conversion', () => {
  it('maps the SVY21 projection origin back to its defining lat/lng', () => {
    const { lat, lng } = svy21ToWgs84(28001.642, 38744.572);
    expect(lat).toBeCloseTo(1.366666, 5);
    expect(lng).toBeCloseTo(103.833333, 5);
  });

  it('maps Aliwal Street carpark coordinates into its known WGS84 position', () => {
    const { lat, lng } = svy21ToWgs84(31045.6165, 31694.0055);
    expect(lat).toBeCloseTo(1.30290302670744, 6);
    expect(lng).toBeCloseTo(103.86068451131253, 6);
  });

  it('keeps converted URA coordinates inside Singapore bounds', () => {
    const { lat, lng } = svy21ToWgs84(28956.4609, 29088.2522);
    expect(lat).toBeGreaterThan(1.15);
    expect(lat).toBeLessThan(1.48);
    expect(lng).toBeGreaterThan(103.5);
    expect(lng).toBeLessThan(104.2);
  });
});

describe('URA Router', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    delete process.env.URA_ACCESS_KEY;
    resetTokenCache();
    resetServiceCache();
    mockAxiosGet.mockReset();
    app = createApp();
  });

  describe('GET /ura/status', () => {
    it('reports not configured when the access key is missing', async () => {
      const res = await request(app).get('/ura/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ configured: false });
      expect(isUraConfigured()).toBe(false);
    });

    it('reports configured when the access key is set', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';

      const res = await request(app).get('/ura/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ configured: true });
    });
  });

  describe('GET /ura/availability', () => {
    it('returns 503 with a clear error when the access key is missing', async () => {
      const res = await request(app).get('/ura/availability');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('URA data service is not configured');
      expect(mockAxiosGet).not.toHaveBeenCalled();
    });

    it('returns normalized live lots with WGS84 coordinates', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';
      mockUpstream();

      const res = await request(app).get('/ura/availability');

      expect(res.status).toBe(200);
      expect(res.body.lots).toHaveLength(2);

      const aliwal = res.body.lots[0];
      expect(aliwal.carparkNo).toBe('A0004');
      expect(aliwal.lotType).toBe('C');
      expect(aliwal.lotsAvailable).toBe(2);
      expect(aliwal.lat).toBeCloseTo(1.302903, 4);
      expect(aliwal.lng).toBeCloseTo(103.860684, 4);

      expect(res.body.lots.map((l: { carparkNo: string }) => l.carparkNo)).not.toContain('BROKEN');
    });

    it('sends the access key and daily token headers upstream', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';
      mockUpstream();

      await request(app).get('/ura/availability');

      const dataCall = mockAxiosGet.mock.calls.find((call) => call[0] === DATA_URL);
      expect(dataCall).toBeDefined();
      const config = dataCall![1] as { headers: Record<string, string>; params: Record<string, string> };
      expect(config.headers.AccessKey).toBe('test-key');
      expect(config.headers.Token).toBe('daily-token-123');
      expect(config.params.service).toBe('Car_Park_Availability');
    });

    it('reuses the daily token and response cache on repeat requests', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';
      mockUpstream();

      const first = await request(app).get('/ura/availability');
      const second = await request(app).get('/ura/availability');

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(tokenCallCount()).toBe(1);
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    it('returns 502 when the token request fails', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';
      mockAxiosGet.mockResolvedValue({
        data: { Status: 'Fail', Message: 'Invalid access key', Result: '' },
      });

      const res = await request(app).get('/ura/availability');

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Invalid access key');
    });

    it('returns 502 and invalidates the token when the data service rejects it', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';
      mockAxiosGet.mockImplementation(async (...args: unknown[]) => {
        const url = args[0] as string;
        if (url === TOKEN_URL) return { data: tokenResponse };
        return { data: { Status: 'Fail', Message: 'Token expired', Result: null } };
      });

      const res = await request(app).get('/ura/availability');
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Token expired');

      mockUpstream();
      const retry = await request(app).get('/ura/availability');
      expect(retry.status).toBe(200);
      expect(tokenCallCount()).toBe(2);
    });
  });

  describe('GET /ura/carparks', () => {
    it('returns 503 when the access key is missing', async () => {
      const res = await request(app).get('/ura/carparks');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('URA data service is not configured');
    });

    it('returns carpark details with geometries converted to locations', async () => {
      process.env.URA_ACCESS_KEY = 'test-key';
      mockAxiosGet.mockImplementation(async (...args: unknown[]) => {
        const url = args[0] as string;
        if (url === TOKEN_URL) return { data: tokenResponse };
        return {
          data: {
            Status: 'Success',
            Message: '',
            Result: [
              {
                ppCode: 'A0004',
                ppName: 'ALIWAL STREET',
                vehCat: 'Car',
                weekdayRate: '$0.50',
                geometries: [{ coordinates: '31045.6165, 31694.0055' }],
              },
            ],
          },
        };
      });

      const res = await request(app).get('/ura/carparks');

      expect(res.status).toBe(200);
      expect(res.body.carparks).toHaveLength(1);
      expect(res.body.carparks[0].ppCode).toBe('A0004');
      expect(res.body.carparks[0].geometries).toBeUndefined();
      expect(res.body.carparks[0].locations[0].lat).toBeCloseTo(1.302903, 4);
      expect(res.body.carparks[0].locations[0].lng).toBeCloseTo(103.860684, 4);
    });
  });

  describe('GET /ura/season', () => {
    it('returns 503 when the access key is missing', async () => {
      const res = await request(app).get('/ura/season');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('URA data service is not configured');
    });
  });
});
