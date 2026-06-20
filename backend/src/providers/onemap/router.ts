import { Router } from 'express';
import type { Request, Response } from 'express';
import { computeWalkRoute, computeBfaRoute } from './routing.js';

const router = Router();

router.post('/onemap/walk', async (req: Request, res: Response) => {
  const { origin, destination } = req.body;

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    res.status(400).json({ error: 'Missing origin or destination coordinates' });
    return;
  }

  try {
    const route = await computeWalkRoute(origin, destination);
    res.json(route);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

router.post('/onemap/bfa', async (req: Request, res: Response) => {
  const { origin, destination } = req.body;

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    res.status(400).json({ error: 'Missing origin or destination coordinates' });
    return;
  }

  try {
    const route = await computeBfaRoute(origin, destination);
    res.json(route);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

export default router;
