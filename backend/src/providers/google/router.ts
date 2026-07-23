import { Router } from 'express';
import type { Request, Response } from 'express';
import { fetchTile, isValidTileType } from './tiles';
import { computeRoute, type TravelMode } from './routing';
import { isLatLng } from '../../lib/coords.js';

const VALID_MODES = new Set(['DRIVE', 'WALK', 'BICYCLE']);
const router = Router();

router.get('/google/maps-key', (_req: Request, res: Response) => {
  const key = process.env.GOOGLE_MAPS_KEY || '';
  res.json({ key });
});

router.get('/google/tiles/:type/:z/:x/:y', async (req: Request, res: Response) => {
  const { type, z, x, y } = req.params;

  if (!isValidTileType(type as string)) {
    res.status(404).json({ error: 'Unknown tile type' });
    return;
  }

  try {
    const { data, contentType } = await fetchTile(type as string, parseInt(z as string), parseInt(x as string), parseInt(y as string));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch tile' });
  }
});

router.post('/google/route', async (req: Request, res: Response) => {
  const { origin, destination, travelMode } = req.body;

  if (!isLatLng(origin) || !isLatLng(destination)) {
    res.status(400).json({ error: 'Missing origin or destination coordinates' });
    return;
  }

  const mode: TravelMode = VALID_MODES.has(travelMode) ? travelMode : 'DRIVE';

  try {
    const route = await computeRoute(origin, destination, mode);
    res.json(route);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

export default router;
