process.env.JWT_SECRET = 'test-secret';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_APP_PASSWORD = 'test-pass';

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findUser = jest.fn(), createUser = jest.fn(), updateUser = jest.fn();

jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { findUnique: findUser, create: createUser, update: updateUser },
    passwordHistory: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  })),
}));

const hash = jest.fn(), compare = jest.fn();
jest.unstable_mockModule('bcryptjs', () => ({ default: { hash, compare } }));

const sign = jest.fn(), verify = jest.fn();
jest.unstable_mockModule('jsonwebtoken', () => ({ default: { sign, verify } }));

const sendMail = jest.fn();
jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: jest.fn().mockReturnValue({ sendMail }) },
}));

const randInt = jest.fn(() => 123456);
jest.unstable_mockModule('crypto', () => ({ default: { randomInt: randInt } }));

jest.unstable_mockModule('express-rate-limit', () => ({
  default: jest.fn().mockImplementation(() => (_req: any, _res: any, next: any) => next()),
}));

const captchaOk = jest.fn();
jest.unstable_mockModule('../../src/providers/auth/routing', () => ({ captchaVerify: captchaOk }));

const authImpl = jest.fn();
jest.unstable_mockModule('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => authImpl(req, res, next),
  AuthRequest: {},
}));

const { default: authRouter } = await import('../../src/providers/auth/router');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  return app;
}

describe('auth router', () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
    authImpl.mockImplementation((req: any, _res: any, next: any) => {
      req.user = { id: 'user-1', email: 'test@test.com' };
      next();
    });
  });

  describe('POST /auth/login', () => {
    it('400 if email missing', async () => {
      const res = await request(app).post('/auth/login').send({ password: 'Pass1234!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });

    it('400 if password missing', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'test@test.com' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password are required');
    });

    it('unknown user gets 401', async () => {
      findUser.mockResolvedValue(null);
      const res = await request(app).post('/auth/login').send({ email: 'nobody@test.com', password: 'Pass1234!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('still runs a password comparison for a missing account, no timing oracle', async () => {
      findUser.mockResolvedValue(null);
      compare.mockResolvedValue(false);
      await request(app).post('/auth/login').send({ email: 'nobody@test.com', password: 'Pass1234!' });
      expect(compare).toHaveBeenCalled();
    });

    it('wrong password is also a 401', async () => {
      findUser.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 0, lockedUntil: null,
      });
      compare.mockResolvedValue(false);
      updateUser.mockResolvedValue({});
      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'WrongPass1!' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('good credentials return a token', async () => {
      findUser.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 0, lockedUntil: null,
      });
      compare.mockResolvedValue(true);
      sign.mockReturnValue('mock-jwt-token');

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Correct1!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe('mock-jwt-token');
      expect(res.body.user).toEqual({ id: '1', username: 'testuser', email: 'test@test.com' });
    });

    it('auth cookie dies with the token, not days later', async () => {
      findUser.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 0, lockedUntil: null,
      });
      compare.mockResolvedValue(true);
      sign.mockReturnValue('mock-jwt-token');

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Correct1!' });
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/Max-Age=3600\b/);
      expect(cookie).not.toMatch(/Max-Age=604800/);
    });

    it('locked account gets 423', async () => {
      findUser.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });
      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Any1!' });
      expect(res.status).toBe(423);
      expect(res.body.error).toContain('Account locked');
    });

    it('does not instantly re-lock a wrong attempt once the lock window expired', async () => {
      findUser.mockResolvedValue({
        id: '1', email: 'test@test.com', password: 'hashed-pw',
        username: 'testuser', failedAttempts: 5,
        lockedUntil: new Date(Date.now() - 60 * 1000),
      });
      compare.mockResolvedValue(false);
      updateUser.mockResolvedValue({});

      const res = await request(app).post('/auth/login').send({ email: 'test@test.com', password: 'Wrong1!' });
      expect(res.status).toBe(401);
      expect(updateUser).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failedAttempts: 1 } }),
      );
    });
  });

  describe('POST /auth/register/send-code', () => {
    it('rejects empty body', async () => {
      const res = await request(app).post('/auth/register/send-code').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('rejects a malformed email', async () => {
      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'test', email: 'bad-email', password: 'StrongPass1!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email address');
    });

    it('weak password gets the requirements message', async () => {
      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'test', email: 'test@test.com', password: 'weak' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Password needs');
    });

    it('400 when email already taken', async () => {
      findUser.mockResolvedValue({ id: '1', email: 'taken@test.com' });
      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'test', email: 'taken@test.com', password: 'StrongPass1!' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email already in use');
    });

    it('sends the verification mail on valid data', async () => {
      findUser.mockResolvedValue(null);
      hash.mockResolvedValue('hashed-password');
      sendMail.mockResolvedValue({});

      const res = await request(app).post('/auth/register/send-code')
        .send({ username: 'newuser', email: 'new@test.com', password: 'StrongPass1!' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Verification code sent!');
      expect(sendMail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/register/verify', () => {
    it('accepts a numeric code that matches the stored string otp', async () => {
      findUser.mockResolvedValue(null);
      hash.mockResolvedValue('hashed-password');
      sendMail.mockResolvedValue({});
      createUser.mockResolvedValue({ id: '9', username: 'newuser', email: 'new@test.com' });
      sign.mockReturnValue('mock-jwt-token');

      await request(app).post('/auth/register/send-code')
        .send({ username: 'newuser', email: 'new@test.com', password: 'StrongPass1!' });

      const res = await request(app).post('/auth/register/verify')
        .send({ email: 'new@test.com', code: 123456 });
      expect(res.status).toBe(201);
      expect(createUser).toHaveBeenCalled();
    });
  });

  describe('POST /auth/verify/captcha', () => {
    it('400 without a token', async () => {
      const res = await request(app).post('/auth/verify/captcha').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Captcha token is required');
    });

    it('failed captcha bubbles up the message', async () => {
      captchaOk.mockResolvedValue({ success: false, message: 'Captcha verification failed' });
      const res = await request(app).post('/auth/verify/captcha').send({ token: 'invalid-token' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Captcha verification failed');
    });

    it('passes a valid captcha through', async () => {
      captchaOk.mockResolvedValue({ success: true, message: 'Captcha verification successful' });
      const res = await request(app).post('/auth/verify/captcha').send({ token: 'valid-token' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('always 200', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });
  });

  describe('GET /auth/me', () => {
    it('401 when middleware rejects', async () => {
      authImpl.mockImplementation((_req: any, res: any) => res.status(401).json({ error: 'Not authenticated' }));
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });

    it('echoes the authed user', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: 'user-1', email: 'test@test.com' });
    });
  });
});
