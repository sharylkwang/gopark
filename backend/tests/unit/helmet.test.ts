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

describe('helmet headers', () => {
  const app = createApp();

  it('X-Content-Type-Options is nosniff', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('X-Frame-Options is SAMEORIGIN', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('X-Powered-By is stripped', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('HSTS is on with a max-age', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  it('CSP is present', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('DNS prefetch control is off', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('Referrer-Policy is present', async () => {
    const res = await request(app).get('/test');
    expect(res.headers['referrer-policy']).toBeDefined();
  });

  it('X-Powered-By stays gone on unknown routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
