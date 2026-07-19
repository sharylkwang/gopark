import { Router } from 'express';
import type { Request, Response } from 'express';
import geoapifyClient from '../../lib/geoapifyClient';
import { classifyPlace, findNearbyParking } from '../overpass/classify.js';
import createLogger from '../../lib/logger.js';

const log = createLogger('geoapify');
const router = Router();

router.get('/geoapify/geocode', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) { res.status(400).json({ error: 'Missing search query' }); return; }

    const response = await geoapifyClient.get('/search', { params: { text: q } });

    const results = response.data?.results || [];
    if (results.length === 0) { res.status(404).json({ error: 'Location not found' }); return; }

    const place = results[0];
    res.json({ name: place.name || q, formatted: place.formatted, lat: place.lat, lon: place.lon });
  } catch (err) {
    log.error(`geocode blew up: ${String(err)}`);
    res.status(500).json({ error: 'geocode failed' });
  }
});

router.get('/geoapify/reverse', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string), lng = parseFloat(req.query.lng as string);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Invalid coordinates' });
      return;
    }

    const response = await geoapifyClient.get('/reverse', { params: { lat, lon: lng } });

    const results = response.data?.results || [];
    if (results.length === 0) { res.json({ name: `${lat}, ${lng}`, formatted: `${lat}, ${lng}` }); return; }

    const place = results[0];
    res.json({ name: place.name || place.street || place.formatted, formatted: place.formatted });
  } catch (err) {
    log.error('reverse geocode failed', err);
    res.json({ name: `${req.query.lat}, ${req.query.lng}`, formatted: '' });
  }
});

router.get('/geoapify/autocomplete', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) { res.status(400).json({ error: 'missing query' }); return; }

    const response = await geoapifyClient.get('/autocomplete', { params: { text: q } });
    res.json(response.data?.results || []);
  } catch (err) {
    log.error(`autocomplete died: ${(err as Error).message}`);
    res.status(500).json({ error: 'suggestions unavailable' });
  }
});

const EMPTY_CLASS = { type: null, hasParking: null, parkingHint: null };

router.get('/overpass/classify', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) { res.status(400).json({ error: 'Invalid coordinates' }); return; }

  try {
    res.json(await classifyPlace(lat, lng) || EMPTY_CLASS);
  } catch {
    res.json(EMPTY_CLASS);
  }
});

router.get('/overpass/nearby-parking', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) { res.status(400).json({ error: 'Invalid coordinates' }); return; }

  try {
    res.json(await findNearbyParking(lat, lng));
  } catch {
    res.json([]);
  }
});

export default router;
