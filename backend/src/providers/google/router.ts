import { Router } from 'express';
import type { Request, Response } from 'express';
import { fetchTile, isValidTileType } from './tiles';
import { computeRoute } from './routing';

const router = Router();

router.get('/google/tiles/:type/:z/:x/:y', async (req: Request, res: Response) => {
  const { type, z, x, y } = req.params;

  if (!isValidTileType(type)) {
    res.status(404).json({ error: 'Unknown tile type' });
    return;
  }

  try {
    const { data, contentType } = await fetchTile(type, parseInt(z), parseInt(x), parseInt(y));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch tile' });
  }
});

router.post('/google/route', async (req: Request, res: Response) => {
  const { origin, destination } = req.body;

  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    res.status(400).json({ error: 'Missing origin or destination coordinates' });
    return;
  }

  try {
    const route = await computeRoute(origin, destination);
    res.json(route);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

export default router;
