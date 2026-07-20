import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import providers from './providers/index.js';
import { startCron, shutdown } from './cron/index.js';
import createLogger from './lib/logger.js';
import authRouter from './providers/auth/router.js';
import { startLiveAvailability } from './providers/carparks/live.js';

const log = createLogger('server');
const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/api', providers);
app.use('/api', authRouter);

const server = app.listen(PORT, '0.0.0.0', () => {
  log.info(`running on port ${PORT}`);
  startCron().catch(err => log.error('cron startup failed', err));
});

startLiveAvailability(server);

async function gracefulShutdown(signal: string) {
  log.info(`${signal} received - shutting down`);
  await shutdown();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
