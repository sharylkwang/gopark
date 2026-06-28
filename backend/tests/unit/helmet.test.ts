import { describe, it, expect } from '@jest/globals';
import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

function createApp() {
  const app = express();
  app.use(helmet());
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Helmet Security Headers', () => {
  const app = createApp();

  it('sets X-Content-Type-Options to nosniff', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options to SAMEORIGIN', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('removes X-Powered-By header', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets Strict-Transport-Security header', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('sets Content-Security-Policy header', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('sets X-DNS-Prefetch-Control to off', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('sets Referrer-Policy header', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  it('does not set X-Powered-By even on error routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
