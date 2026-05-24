import { Router } from 'express';
import type { Request, Response } from 'express';
import { fetchTile, isValidProvider, getProviderList } from '../services/tiles';

const router = Router();

router.get('/tiles/providers', (_req: Request, res: Response) => {
  res.json(getProviderList());
});

router.get('/tiles/:provider/:z/:x/:y', async (req: Request, res: Response) => {
  const { provider, z, x, y } = req.params;

  if (!isValidProvider(provider)) {
    res.status(404).json({ error: 'Unknown tile provider' });
    return;
  }

  try {
    const { data, contentType } = await fetchTile(provider, parseInt(z), parseInt(x), parseInt(y));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch tile' });
  }
});

export default router;
