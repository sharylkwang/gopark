import { Router } from 'express';
import type { Request, Response } from 'express';
import { isUraConfigured } from './token.js';
import { fetchLiveLots, fetchCarparkDetails, fetchSeasonCarparks } from './service.js';

const router = Router();

function sendNotConfigured(res: Response): void {
  res.status(503).json({
    error: 'URA data service is not configured',
    hint: 'Set the URA_ACCESS_KEY environment variable',
  });
}

function sendUpstreamError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  res.status(502).json({ error: message });
}

router.get('/ura/status', (_req: Request, res: Response) => {
  res.json({ configured: isUraConfigured() });
});

router.get('/ura/availability', async (_req: Request, res: Response) => {
  if (!isUraConfigured()) {
    sendNotConfigured(res);
    return;
  }

  try {
    const lots = await fetchLiveLots();
    res.setHeader('Cache-Control', 'public, max-age=180');
    res.json({ lots });
  } catch (err) {
    sendUpstreamError(res, err);
  }
});

router.get('/ura/carparks', async (_req: Request, res: Response) => {
  if (!isUraConfigured()) {
    sendNotConfigured(res);
    return;
  }

  try {
    const carparks = await fetchCarparkDetails();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ carparks });
  } catch (err) {
    sendUpstreamError(res, err);
  }
});

router.get('/ura/season', async (_req: Request, res: Response) => {
  if (!isUraConfigured()) {
    sendNotConfigured(res);
    return;
  }

  try {
    const carparks = await fetchSeasonCarparks();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({ carparks });
  } catch (err) {
    sendUpstreamError(res, err);
  }
});

export default router;
