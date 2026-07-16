import { describe, it, expect } from '@jest/globals';

const zhipuKey = process.env.ZHIPUAI_API_KEY;
if (!zhipuKey) console.warn('ZHIPUAI_API_KEY not set (optional), skipping its check');

function expectSet(key: string) {
  const val = process.env[key];
  expect(val).toBeDefined();
  expect(val!.trim().length).toBeGreaterThan(0);
}

describe('api keys', () => {
  describe('required keys present', () => {
    it('GEOAPIFY_KEY set', () => expectSet('GEOAPIFY_KEY'));
    it('DATAGOVSG_KEY set', () => expectSet('DATAGOVSG_KEY'));
    it('DATAMALL_API set', () => expectSet('DATAMALL_API'));
  });

  describe('required keys actually work', () => {
    it('geoapify can geocode Singapore', async () => {
      const key = process.env.GEOAPIFY_KEY;
      if (!key) return;
      const url = `https://api.geoapify.com/v1/geocode/search?text=Singapore&limit=1&format=json&apiKey=${key}`;
      const res = await fetch(url);
      expect(res.status).not.toBe(401);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.results?.length).toBeGreaterThan(0);
    }, 15000);

    it('data.gov.sg returns carpark availability', async () => {
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

    it('datamall responds with LTA carpark data', async () => {
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
    (zhipuKey ? it : it.skip)('zhipu chat endpoint accepts the key', async () => {
      const res = await fetch('https://api.z.ai/api/coding/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${zhipuKey}` },
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
