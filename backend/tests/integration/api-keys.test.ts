import { describe, it, expect } from '@jest/globals';

const zhipuKey = process.env.ZHIPUAI_API_KEY;
if (!zhipuKey) console.warn('ZHIPUAI_API_KEY not set (optional), skipping its check');
const uraKey = process.env.URA_ACCESS_KEY;
if (!uraKey) console.warn('URA_ACCESS_KEY not set (optional), skipping its check');
const onemapEmail = process.env.ONEMAP_EMAIL, onemapPassword = process.env.ONEMAP_EMAIL_PASSWORD;
if (!onemapEmail || !onemapPassword) console.warn('ONEMAP credentials not set (optional), skipping their check');
const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
if (!turnstileSecret) console.warn('TURNSTILE_SECRET_KEY not set (optional), skipping its check');
const gmapsKey = process.env.GOOGLE_MAPS_KEY;
if (gmapsKey === undefined) console.warn('GOOGLE_MAPS_KEY not set (optional), skipping its check');

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

    (uraKey ? it : it.skip)('ura hands out a daily token', async () => {
      const res = await fetch('https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1', {
        headers: { AccessKey: uraKey!, 'User-Agent': 'GoPark/1.0' },
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.Status).toBe('Success');
      expect(typeof body.Result).toBe('string');
    }, 15000);

    (onemapEmail && onemapPassword ? it : it.skip)('onemap login yields an access token', async () => {
      const res = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: onemapEmail, password: onemapPassword }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(typeof body.access_token).toBe('string');
      expect(body.access_token.length).toBeGreaterThan(0);
    }, 15000);

    (turnstileSecret ? it : it.skip)('turnstile siteverify accepts the secret', async () => {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: turnstileSecret!, response: 'integration-test-dummy-token' }),
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body['error-codes']).not.toContain('invalid-input-secret');
    }, 15000);

    (gmapsKey === undefined ? it.skip : it)('google maps key is non-empty', () => {
      expect(gmapsKey!.trim().length).toBeGreaterThan(0);
    });
  });
});
