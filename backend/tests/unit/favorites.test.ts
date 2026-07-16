import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findFavs = jest.fn(), upsertFav = jest.fn(), deleteFavs = jest.fn();

jest.unstable_mockModule('../../src/db/index', () => ({
  default: {
    fav: { findMany: findFavs, upsert: upsertFav, deleteMany: deleteFavs },
  },
}));

const authImpl = jest.fn();
jest.unstable_mockModule('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => authImpl(req, res, next),
  AuthRequest: {},
}));

const { default: favoritesRouter } = await import('../../src/providers/favorites/router');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(favoritesRouter);
  return app;
}

describe('favorites router', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
    authImpl.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'user-1', email: 'test@test.com' };
      next();
    });
  });

  describe('GET /favorites', () => {
    it('401 when not logged in', async () => {
      authImpl.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Not authenticated' });
      });
      const res = await request(app).get('/favorites');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Not authenticated');
    });

    it('lists just the carpark ids', async () => {
      findFavs.mockResolvedValue([
        { carparkId: 'CP1' },
        { carparkId: 'CP2' },
        { carparkId: 'CP3' },
      ]);

      const res = await request(app).get('/favorites');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(['CP1', 'CP2', 'CP3']);
    });

    it('no favorites means empty array', async () => {
      findFavs.mockResolvedValue([]);
      const res = await request(app).get('/favorites');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /favorites/:carparkId', () => {
    it('upserts the favorite for the authed user', async () => {
      upsertFav.mockResolvedValue({});

      const res = await request(app).post('/favorites/CP1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(upsertFav).toHaveBeenCalledWith({
        where: { userId_carparkId: { userId: 'user-1', carparkId: 'CP1' } },
        create: { userId: 'user-1', carparkId: 'CP1' },
        update: {},
      });
    });

    it('adding needs auth', async () => {
      authImpl.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Not authenticated' });
      });
      const res = await request(app).post('/favorites/CP1');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /favorites/:carparkId', () => {
    it('deletes by user and carpark id', async () => {
      deleteFavs.mockResolvedValue({ count: 1 });

      const res = await request(app).delete('/favorites/CP1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(deleteFavs).toHaveBeenCalledWith({
        where: { userId: 'user-1', carparkId: 'CP1' },
      });
    });

    it('removing needs auth too', async () => {
      authImpl.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Not authenticated' });
      });
      const res = await request(app).delete('/favorites/CP1');
      expect(res.status).toBe(401);
    });
  });
});
