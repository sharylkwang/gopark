import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockFavFindMany = jest.fn();
const mockFavUpsert = jest.fn();
const mockFavDeleteMany = jest.fn();

jest.unstable_mockModule('../../src/db/index', () => ({
  default: {
    fav: {
      findMany: mockFavFindMany,
      upsert: mockFavUpsert,
      deleteMany: mockFavDeleteMany,
    },
  },
}));

const mockRequireAuthImpl = jest.fn();
jest.unstable_mockModule('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => mockRequireAuthImpl(req, res, next),
  AuthRequest: {},
}));

const { default: favoritesRouter } = await import('../../src/providers/favorites/router');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(favoritesRouter);
  return app;
}

describe('Favorites Router', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
    mockRequireAuthImpl.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'user-1', email: 'test@test.com' };
      next();
    });
  });

  describe('GET /favorites', () => {
    it('returns 401 without authentication', async () => {
      mockRequireAuthImpl.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Not authenticated' });
      });

      const res = await request(app).get('/favorites');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Not authenticated');
    });

    it('returns carpark IDs when authenticated', async () => {
      mockFavFindMany.mockResolvedValue([
        { carparkId: 'CP1' },
        { carparkId: 'CP2' },
        { carparkId: 'CP3' },
      ]);

      const res = await request(app).get('/favorites');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(['CP1', 'CP2', 'CP3']);
    });

    it('returns empty array when no favorites exist', async () => {
      mockFavFindMany.mockResolvedValue([]);

      const res = await request(app).get('/favorites');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /favorites/:carparkId', () => {
    it('returns ok true when adding a favorite', async () => {
      mockFavUpsert.mockResolvedValue({});

      const res = await request(app).post('/favorites/CP1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockFavUpsert).toHaveBeenCalledWith({
        where: { userId_carparkId: { userId: 'user-1', carparkId: 'CP1' } },
        create: { userId: 'user-1', carparkId: 'CP1' },
        update: {},
      });
    });

    it('returns 401 without authentication', async () => {
      mockRequireAuthImpl.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Not authenticated' });
      });

      const res = await request(app).post('/favorites/CP1');

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /favorites/:carparkId', () => {
    it('returns ok true when removing a favorite', async () => {
      mockFavDeleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app).delete('/favorites/CP1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(mockFavDeleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', carparkId: 'CP1' },
      });
    });

    it('returns 401 without authentication', async () => {
      mockRequireAuthImpl.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: 'Not authenticated' });
      });

      const res = await request(app).delete('/favorites/CP1');

      expect(res.status).toBe(401);
    });
  });
});
