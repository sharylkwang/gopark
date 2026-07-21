process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_APP_PASSWORD = 'test-pass';

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { findUnique: mockUserFindUnique, create: mockUserCreate, update: mockUserUpdate },
    passwordHistory: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  })),
}));

const mockHash = jest.fn();
const mockCompare = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({ default: { hash: mockHash, compare: mockCompare } }));

const mockSign = jest.fn();
const mockVerify = jest.fn();
jest.unstable_mockModule('jsonwebtoken', () => ({ default: { sign: mockSign, verify: mockVerify } }));

const mockSendMail = jest.fn();
jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }) },
}));

const mockRandomInt = jest.fn(() => 123456);
jest.unstable_mockModule('crypto', () => ({ default: { randomInt: mockRandomInt } }));

jest.unstable_mockModule('express-rate-limit', () => ({
  default: jest.fn().mockImplementation(() => (_req: any, _res: any, next: any) => next()),
}));

const mockCaptchaVerify = jest.fn();
jest.unstable_mockModule('../../src/providers/auth/routing', () => ({ captchaVerify: mockCaptchaVerify }));

const mockRequireAuthImpl = jest.fn();
jest.unstable_mockModule('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => mockRequireAuthImpl(req, res, next),
  AuthRequest: {},
}));

const { default: authRouter } = await import('../../src/providers/auth/router');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  return app;
}

describe('Auth Router', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
    mockRequireAuthImpl.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'user-1', email: 'test@test.com' };
      next();
    });
  });

  describe('POST /auth/login', () => {
    it('returns 400 when email is missing', async () => {
      const res = await request(app).post('/auth/login').send({ password: 'Pass1234!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });

    it('returns 401 for non-existent user', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      const res = await request(app).post('/auth/login').send({ email: 'nobody@test.com', password: 'Pass1234!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 401 for wrong password', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 0, lockedUntil: null,
      });
      mockCompare.mockResolvedValue(false);
      mockUserUpdate.mockResolvedValue({});

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'WrongPass1!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 200 with token for correct credentials', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 0, lockedUntil: null,
      });
      mockCompare.mockResolvedValue(true);
      mockSign.mockReturnValue('mock-jwt-token');

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Correct1!' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBe('mock-jwt-token');
      expect(res.body.user).toEqual({ id: '1', username: 'testuser', email: 'test@test.com' });
    });

    it('returns 423 for locked account', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Any1!' });
      expect(res.status).toBe(423);
      expect(res.body.error).toContain('Account locked');
    });

    it('does not instantly re-lock a wrong attempt after the lock window expired', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 5,
        lockedUntil: new Date(Date.now() - 60 * 1000),
      });
      mockCompare.mockResolvedValue(false);
      mockUserUpdate.mockResolvedValue({});

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Wrong1!' });
      expect(res.status).toBe(401);
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failedAttempts: 1 } }),
      );
    });
  });

  describe('POST /auth/register/send-code', () => {
    it('returns 400 for missing fields', async () => {
      const res = await request(app).post('/auth/register/send-code').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'test', email: 'bad-email', password: 'StrongPass1!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email address');
    });

    it('returns 400 for weak password', async () => {
      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'test', email: 'test@test.com', password: 'weak' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Password needs');
    });

    it('returns 400 for existing email', async () => {
      mockUserFindUnique.mockResolvedValue({ id: '1', email: 'taken@test.com' });
      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'test', email: 'taken@test.com', password: 'StrongPass1!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email already in use');
    });

    it('returns 200 for valid registration data', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockHash.mockResolvedValue('hashed-password');
      mockSendMail.mockResolvedValue({});

      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'newuser', email: 'new@test.com', password: 'StrongPass1!' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Verification code sent!');
      expect(mockSendMail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/register/verify', () => {
    it('accepts a numeric code that matches the stored string otp', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockHash.mockResolvedValue('hashed-password');
      mockSendMail.mockResolvedValue({});
      mockUserCreate.mockResolvedValue({ id: '9', username: 'newuser', email: 'new@test.com' });
      mockSign.mockReturnValue('mock-jwt-token');

      await request(app).post('/auth/register/send-code')
        .send({ username: 'newuser', email: 'new@test.com', password: 'StrongPass1!' });

      const res = await request(app).post('/auth/register/verify')
        .send({ email: 'new@test.com', code: 123456 });
      expect(res.status).toBe(201);
      expect(mockUserCreate).toHaveBeenCalled();
    });
  });

  describe('POST /auth/verify/captcha', () => {
    it('returns 400 when token is missing', async () => {
      const res = await request(app).post('/auth/verify/captcha').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Captcha token is required');
    });

    it('returns 400 for invalid captcha', async () => {
      mockCaptchaVerify.mockResolvedValue({ success: false, message: 'Captcha verification failed' });
      const res = await request(app).post('/auth/verify/captcha').send({ token: 'invalid-token' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Captcha verification failed');
    });

    it('returns 200 for valid captcha', async () => {
      mockCaptchaVerify.mockResolvedValue({ success: true, message: 'Captcha verification successful' });
      const res = await request(app).post('/auth/verify/captcha').send({ token: 'valid-token' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 200 with logged out message', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 when not authenticated', async () => {
      mockRequireAuthImpl.mockImplementation((_req: any, res: any) => res.status(401).json({ error: 'Not authenticated' }));
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 200 with user object when authenticated', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: 'user-1', email: 'test@test.com' });
    });
  });
});
