import { Router } from 'express';
import type { Request, Response } from 'express';
import { computeWalkRoute, computeBfaRoute } from './routing.js';

const router = Router();
const msg = (e: unknown) => e instanceof Error ? e.message : 'Unknown error';

router.post('/onemap/walk', async (req: Request, res: Response) => {
  const { origin, destination } = req.body;
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    res.status(400).json({ error: 'need origin and destination' });
    return;
  }

  try {
    res.json(await computeWalkRoute(origin, destination));
  } catch (err) {
    res.status(502).json({ error: msg(err) });
  }
});

router.post('/onemap/bfa', async (req: Request, res: Response) => {
  const { origin, destination } = req.body;
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    res.status(400).json({ error: 'missing origin/destination coords' });
    return;
  }

  try {
    res.json(await computeBfaRoute(origin, destination));
  } catch (err) {
    res.status(502).json({ error: msg(err) });
  }
});

export default router;
