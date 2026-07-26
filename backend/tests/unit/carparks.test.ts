process.env.JWT_SECRET = 'test-secret';

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findCarparks = jest.fn(), findCarpark = jest.fn(), findAvail = jest.fn();
const runScraper = jest.fn(), smartSearch = jest.fn(), applyScraped = jest.fn();

jest.unstable_mockModule('../../src/db/index', () => ({
  default: {
    carpark: { findMany: findCarparks, findUnique: findCarpark },
    availability: { findMany: findAvail },
  },
}));

jest.unstable_mockModule('../../src/cron/scraper/index', () => ({
  runScraper,
  smartSearch,
}));

jest.unstable_mockModule('../../src/cron/scraper/apply', () => ({
  applyScraped,
}));

jest.unstable_mockModule('../../src/lib/logger', () => ({
  default: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const { default: carparkRouter } = await import('../../src/providers/carparks/router');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(carparkRouter);
  return app;
}

const sampleCarpark = {
  id: 'CP1', name: 'Test Carpark', lat: 1.3, lng: 103.8,
  address: '123 Test St', agency: 'HDB', sources: ['HDB'], lotTypes: 'C',
  availability: [{ lotType: 'C', available: 50, total: 100 }],
};

describe('carparks router', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  describe('GET /carparks', () => {
    it('formats the list with availability keyed by lot type', async () => {
      findCarparks.mockResolvedValue([sampleCarpark]);
      const res = await request(app).get('/carparks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('CP1');
      expect(res.body[0].name).toBe('Test Carpark');
      expect(res.body[0].availability).toEqual({ C: { available: 50, total: 100 } });
    });

    it('empty db gives empty array', async () => {
      findCarparks.mockResolvedValue([]);
      const res = await request(app).get('/carparks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /carparks/nearby', () => {
    it('nearest comes first, with a distance field', async () => {
      const near = { ...sampleCarpark, id: 'CP_NEAR', lat: 1.3001, lng: 103.8001, rates: [] };
      const far = { ...sampleCarpark, id: 'CP_FAR', lat: 1.305, lng: 103.805, rates: [] };
      findCarparks.mockResolvedValue([far, near]);

      const res = await request(app).get('/carparks/nearby?lat=1.3&lng=103.8');

      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe('CP_NEAR');
      expect(res.body[1].id).toBe('CP_FAR');
      expect(res.body[0].distance).toBeDefined();
    });

    it('rejects bad lat/lng: non-numeric, out of range, or missing', async () => {
      for (const q of ['?lat=abc&lng=xyz', '?lat=91&lng=103.8', '?lat=1.3&lng=181', '']) {
        const res = await request(app).get(`/carparks/nearby${q}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid coordinates');
      }
    });
  });

  describe('GET /carparks/availability', () => {
    it('groups rows by carpark then lot type', async () => {
      const updatedAt = new Date('2024-01-01T00:00:00Z');
      findAvail.mockResolvedValue([
        { carparkId: 'CP1', lotType: 'C', available: 50, total: 100, updatedAt },
        { carparkId: 'CP1', lotType: 'Y', available: 10, total: 20, updatedAt },
        { carparkId: 'CP2', lotType: 'C', available: 30, total: 60, updatedAt },
      ]);

      const res = await request(app).get('/carparks/availability');

      expect(res.status).toBe(200);
      expect(res.body.carparks.CP1.C).toEqual({ available: 50, total: 100, updatedAt: updatedAt.toISOString() });
      expect(res.body.carparks.CP1.Y).toEqual({ available: 10, total: 20, updatedAt: updatedAt.toISOString() });
      expect(res.body.carparks.CP2.C).toEqual({ available: 30, total: 60, updatedAt: updatedAt.toISOString() });
      expect(res.body.updatedAt).toBeDefined();
    });

    it('updatedAt is null when the table is empty', async () => {
      findAvail.mockResolvedValue([]);
      const res = await request(app).get('/carparks/availability');
      expect(res.status).toBe(200);
      expect(res.body.updatedAt).toBeNull();
      expect(res.body.carparks).toEqual({});
    });
  });

  describe('GET /carparks/:id', () => {
    it('full detail payload for a known id', async () => {
      findCarpark.mockResolvedValue({
        id: 'CP1', name: 'Test Carpark', lat: 1.3, lng: 103.8,
        address: '123 Test St', agency: 'HDB', sources: ['HDB'],
        sourceIds: { hdb: 'HDB-001' }, lotTypes: 'C', metadata: {},
        detailsUpdatedAt: null, availabilityUpdatedAt: null,
        rates: [{
          amount: 0.6, durationMins: 30, unit: 'per_entry', vehicleType: 'Car',
          periodStart: '07:00', periodEnd: '17:00', isFirst: false, dayType: 'weekday',
          sources: ['HDB'],
        }],
        availability: [{ lotType: 'C', available: 50, total: 100, updatedAt: new Date('2024-01-01') }],
      });

      const res = await request(app).get('/carparks/CP1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('CP1');
      expect(res.body.name).toBe('Test Carpark');
      expect(res.body.rates).toHaveLength(1);
      expect(res.body.rates[0].amount).toBe(0.6);
      expect(res.body.rates[0].confirmedBy).toBe(1);
      expect(res.body.availability.C).toBeDefined();
      expect(res.body.availability.C.available).toBe(50);
    });

    it('404 on unknown id', async () => {
      findCarpark.mockResolvedValue(null);
      const res = await request(app).get('/carparks/UNKNOWN');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  describe('POST /carparks/scrape', () => {
    it('rejects an unauthenticated request without scraping or writing', async () => {
      const res = await request(app).post('/carparks/scrape?full=true').send({});
      expect(res.status).toBe(401);
      expect(runScraper).not.toHaveBeenCalled();
      expect(smartSearch).not.toHaveBeenCalled();
      expect(applyScraped).not.toHaveBeenCalled();
    });
  });
});
