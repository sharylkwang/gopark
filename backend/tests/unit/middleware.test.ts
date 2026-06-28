process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';

const { requireAuth } = await import('../../src/middleware/auth');

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('requireAuth', () => {
  it('returns 401 when no token provided', () => {
    const req = { headers: {}, cookies: {} } as any;
    const res = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', () => {
    const req = {
      headers: { authorization: 'Bearer invalid-token' },
      cookies: {},
    } as any;
    const res = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(res.clearCookie).toHaveBeenCalledWith('gopark_token');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with user set for valid Bearer token', () => {
    const token = jwt.sign({ id: 'user-1', email: 'test@test.com' }, 'test-secret');
    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
    } as any;
    const res = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-1', email: 'test@test.com' });
  });

  it('calls next with user set for valid cookie token', () => {
    const token = jwt.sign({ id: 'user-2', email: 'cookie@test.com' }, 'test-secret');
    const req = {
      headers: {},
      cookies: { gopark_token: token },
    } as any;
    const res = createMockResponse();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-2', email: 'cookie@test.com' });
  });
});
