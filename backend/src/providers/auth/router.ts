import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import prisma from '../../db/index.js';
import createLogger from '../../lib/logger.js';
import { requireAuth, AuthRequest } from '../../middleware/auth';
import { captchaVerify } from './routing';

const router = Router();
const log = createLogger('auth');

const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
  type: 'register' | 'reset';
  username?: string;
  hashedPassword?: string;
}

const otpCache = new Map<string, OtpEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of otpCache.entries()) {
    if (now > entry.expiresAt) otpCache.delete(email);
  }
}, 60 * 1000).unref();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
});

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

const PASSWORD_ERROR = 'Password needs 8+ characters with uppercase, lowercase, number, and special character.';
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function isStrongPassword(password: unknown) {
  return typeof password === 'string'
    && password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\`~]/.test(password);
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie('gopark_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000,
    path: '/',
  });
}

async function sendOtpEmail(email: string, heading: string, intro: string, otp: string) {
  await transporter.sendMail({
    from: `"GoPark Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your GoPark Verification Code',
    html: `
      <div style="font-family: sans-serif; text-align: center; padding: 20px;">
        <h2>${heading}</h2>
        <p>${intro}</p>
        <h1 style="background: #f2f2f2; padding: 10px; letter-spacing: 5px; color: #c92a2a;">${otp}</h1>
        <p style="color: #667; font-size: 12px;">This code expires in 10 minutes.</p>
      </div>
    `,
  });
}

const window15 = 15 * 60 * 1000;
const loginLimiter = rateLimit({ windowMs: window15, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts, wait a few minutes' } });
const emailLimiter = rateLimit({
  max: 5,
  windowMs: window15,
  message: { error: 'Slow down - try again shortly' },
  standardHeaders: true,
  legacyHeaders: false,
});
const resetLimiter = rateLimit({
  message: { error: 'Reset limit hit, come back later' },
  windowMs: window15,
  max: 5,
  legacyHeaders: false,
  standardHeaders: true,
});
const verifyLimiter = rateLimit({ windowMs: window15, max: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many verification attempts, come back later' } });
const captchaLimiter = rateLimit({ windowMs: window15, standardHeaders: true, max: 10, legacyHeaders: false, message: { error: 'Too many tries. Give it a few minutes' } });

router.post('/auth/verify/captcha', captchaLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Captcha token is required' });

    const response = await captchaVerify(token);
    if (!response.success) return res.status(400).json({ error: response.message });

    res.status(200).json({ success: true, message: 'captcha ok' });
  } catch (err) {
    log.error('captcha check blew up', err);
    res.status(500).json({ error: 'captcha check failed' });
  }
});

router.post('/auth/register/send-code', emailLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const email = (req.body.email || '').toLowerCase().trim();

    if (!username || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
    if (!email.includes('@') || !email.includes('.')) return res.status(400).json({ error: 'Invalid email address' });
    if (!isStrongPassword(password)) return res.status(400).json({ error: PASSWORD_ERROR });
    if (username.length > 50 || email.length > 100) return res.status(400).json({ error: 'Input too long' });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const otp = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 10);

    otpCache.set(email, { username, hashedPassword, otp, attempts: 0, type: 'register', expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendOtpEmail(email, `Welcome to GoPark, ${username}!`, 'Here is your 6-digit verification code to complete your registration:', otp);

    res.status(200).json({ message: 'Verification code sent!' });
  } catch (err) {
    log.error('otp email failed', err);
    res.status(500).json({ error: 'could not send email' });
  }
});

router.post('/auth/register/verify', verifyLimiter, async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const email = (req.body.email || '').toLowerCase().trim();

    const cached = otpCache.get(email);
    if (!cached || cached.type !== 'register') return res.status(400).json({ error: 'verification expired, sign up again' });

    if (Date.now() > cached.expiresAt) {
      otpCache.delete(email);
      return res.status(400).json({ error: 'code expired' });
    }

    if (String(cached.otp) !== String(code)) {
      cached.attempts++;
      if (cached.attempts >= 5) {
        otpCache.delete(email);
        return res.status(429).json({ error: 'too many attempts, sign up again' });
      }
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      otpCache.delete(email);
      return res.status(400).json({ error: 'Email already in use' });
    }

    const newUser = await prisma.user.create({
      data: {
        username: cached.username!,
        email,
        password: cached.hashedPassword!,
        passwordHistory: { create: { password: cached.hashedPassword! } },
      },
    });

    otpCache.delete(email);
    const token = signToken(newUser);
    setAuthCookie(res, token);

    res.status(201).json({
      message: 'account created',
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email },
    });
  } catch (err) {
    log.error('register verify failed', err);
    res.status(500).json({ error: 'verification failed' });
  }
});

router.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const email = (req.body.email || '').toLowerCase().trim();

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}.` });
    }

    const lockExpired = user.lockedUntil != null && user.lockedUntil <= new Date();
    const priorAttempts = lockExpired ? 0 : user.failedAttempts;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const attempts = priorAttempts + 1;

      if (attempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: attempts, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
        });
        return res.status(423).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
      }

      await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: attempts } });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.failedAttempts > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null } });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    res.status(200).json({
      message: 'logged in',
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    log.error('login failed', err);
    res.status(500).json({ error: 'Something broke during login, try again' });
  }
});

router.post('/auth/refresh', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token });
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('gopark_token', { path: '/' });
  res.json({ message: 'Logged out' });
});

router.post('/auth/password/forgot', emailLimiter, async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const otp = generateOtp();
      otpCache.set(email, { otp, attempts: 0, type: 'reset', expiresAt: Date.now() + 10 * 60 * 1000 });
      await sendOtpEmail(email, 'Password Reset Request', 'You requested a password reset. Use this code to continue:', otp);
    }

    res.status(200).json({ message: 'If account exists, code sent.' });
  } catch (err) {
    log.error('forgot password failed', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

router.post('/auth/password/reset', resetLimiter, async (req: Request, res: Response) => {
  try {
    const { code, newPassword } = req.body;
    const email = (req.body.email || '').toLowerCase().trim();

    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: PASSWORD_ERROR });

    const cached = otpCache.get(email);
    if (!cached || cached.type !== 'reset') return res.status(400).json({ error: 'Invalid code' });

    if (Date.now() > cached.expiresAt) {
      otpCache.delete(email);
      return res.status(400).json({ error: 'code expired' });
    }

    if (String(cached.otp) !== String(code)) {
      cached.attempts++;
      if (cached.attempts >= 5) {
        otpCache.delete(email);
        return res.status(429).json({ error: 'too many attempts, request a new code' });
      }
      return res.status(400).json({ error: 'Invalid code' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      otpCache.delete(email);
      return res.status(404).json({ error: 'User not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await prisma.passwordHistory.findMany({
      where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
    });

    for (const record of history) {
      const isMatch = await bcrypt.compare(newPassword, record.password);
      if (isMatch) return res.status(400).json({ error: 'password does not meet requirements' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, failedAttempts: 0, lockedUntil: null },
      }),
      prisma.passwordHistory.create({ data: { userId: user.id, password: hashedPassword } }),
    ]);

    otpCache.delete(email);
    res.status(200).json({ message: 'password updated' });
  } catch (err) {
    log.error('password reset failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
