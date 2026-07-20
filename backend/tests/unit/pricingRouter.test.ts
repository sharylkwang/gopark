import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockRateFindMany = jest.fn();

jest.unstable_mockModule('../../src/db/index', () => ({
  default: { rate: { findMany: mockRateFindMany } },
}));

jest.unstable_mockModule('../../src/lib/logger', () => ({
  default: jest.fn().mockReturnValue({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

const { default: pricingRouter } = await import('../../src/providers/pricing/router');

function app() {
  const a = express();
  a.use(pricingRouter);
  return a;
}

describe('GET /pricing/quote', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing carparkId', async () => {
    const res = await request(app()).get('/pricing/quote?durationMins=60');
    expect(res.status).toBe(400);
    expect(mockRateFindMany).not.toHaveBeenCalled();
  });

  it('rejects a non-positive or absurd duration', async () => {
    expect((await request(app()).get('/pricing/quote?carparkId=X&durationMins=0')).status).toBe(400);
    expect((await request(app()).get('/pricing/quote?carparkId=X&durationMins=-5')).status).toBe(400);
    expect((await request(app()).get('/pricing/quote?carparkId=X&durationMins=abc')).status).toBe(400);
  });

  it('rejects an unparseable timestamp', async () => {
    const res = await request(app()).get('/pricing/quote?carparkId=X&durationMins=60&at=not-a-date');
    expect(res.status).toBe(400);
  });

  it('computes an authoritative cost from the carpark rates', async () => {
    mockRateFindMany.mockResolvedValue([
      { amount: 1.2, durationMins: 30, unit: 'per_30min', vehicleType: 'C', periodStart: null, periodEnd: null, isFirst: false, dayType: 'all' },
    ]);
    const res = await request(app()).get('/pricing/quote?carparkId=ACB&durationMins=60&at=2026-07-20T09:00:00.000Z');
    expect(res.status).toBe(200);
    expect(res.body.cost).toBe(2.4);
    expect(res.body.carparkId).toBe('ACB');
    expect(mockRateFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { carparkId: 'ACB' } }));
  });
});
