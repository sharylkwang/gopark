import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const otpCache = new Map(); 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

router.post('/auth/register/send-code', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpCache.set(email, {
      username,
      password, 
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000 
    });

    await transporter.sendMail({
      from: `"GoPark Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your GoPark Verification Code',
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>Welcome to GoPark, ${username}! ⚡</h2>
          <p>Here is your 6-digit verification code to complete your registration:</p>
          <h1 style="background: #f3f4f6; padding: 10px; letter-spacing: 5px; color: #dc2626;">${otp}</h1>
          <p style="color: #6b7280; font-size: 12px;">This code expires in 10 minutes.</p>
        </div>
      `
    });

    res.status(200).json({ message: 'Verification code sent!' });

  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.post('/auth/register/verify', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    const cachedData = otpCache.get(email);
    
    if (!cachedData) {
      res.status(400).json({ error: 'Verification session expired. Please sign up again.' });
      return;
    }

    if (cachedData.otp !== code) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    if (Date.now() > cachedData.expiresAt) {
      otpCache.delete(email); 
      res.status(400).json({ error: 'Verification code has expired' });
      return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(cachedData.password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        username: cachedData.username,
        email,
        password: hashedPassword,
      },
    });

    otpCache.delete(email);
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ 
      message: 'User verified and created successfully', 
      token, 
      user: { id: newUser.id, username: newUser.username, email: newUser.email } 
    });

  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email } });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

export default router;