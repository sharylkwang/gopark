import { describe, it, expect } from '@jest/globals';

const REQUIRED_KEYS = ['GEOAPIFY_KEY', 'DATAGOVSG_KEY', 'DATAMALL_API'] as const;
const OPTIONAL_KEYS = ['ZHIPUAI_API_KEY'] as const;

describe('API Key Verification', () => {
  describe('required keys are set', () => {
    for (const key of REQUIRED_KEYS) {
      it(`${key} is defined and non-empty`, () => {
        const val = process.env[key];
        expect(val).toBeDefined();
        expect(val!.trim().length).toBeGreaterThan(0);
      });
    }
  });

  describe('required keys are valid', () => {
    it('GEOAPIFY_KEY can geocode Singapore', async () => {
      const key = process.env.GEOAPIFY_KEY;
      if (!key) return;
      const url = `https://api.geoapify.com/v1/geocode/search?text=Singapore&limit=1&format=json&apiKey=${key}`;
      const res = await fetch(url);
      expect(res.status).not.toBe(401);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.results?.length).toBeGreaterThan(0);
    }, 15000);

    it('DATAGOVSG_KEY can fetch carpark availability', async () => {
      const key = process.env.DATAGOVSG_KEY;
      if (!key) return;
      const res = await fetch('https://api.data.gov.sg/v1/transport/carpark-availability', {
        headers: { 'x-api-key': key },
      });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.items?.[0]?.carpark_data?.length).toBeGreaterThan(0);
    }, 15000);

    it('DATAMALL_API can fetch LTA carpark data', async () => {
      const key = process.env.DATAMALL_API;
      if (!key) return;
      const res = await fetch('https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2', {
        headers: { AccountKey: key, Accept: 'application/json' },
      });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(Array.isArray(body.value)).toBe(true);
    }, 15000);
  });

  describe('optional keys', () => {
    for (const key of OPTIONAL_KEYS) {
      it(`${key} is set or skipped`, () => {
        const val = process.env[key];
        if (!val) {
          console.log(`  ⚠ ${key} not set (optional)`);
        }
        expect(true).toBe(true);
      });
    }

    it('ZHIPUAI_API_KEY can reach chat endpoint if set', async () => {
      const key = process.env.ZHIPUAI_API_KEY;
      if (!key) return;
      const res = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.ZHIPUAI_MODEL || 'glm-4-flash',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      expect(res.status).not.toBe(401);
    }, 15000);
  });
});
