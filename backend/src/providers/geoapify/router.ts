import { Router } from 'express';
import type { Request, Response } from 'express';
import geoapifyClient from '../../lib/geoapifyClient';
import createLogger from '../../lib/logger.js';

const log = createLogger('geoapify');
const router = Router();

router.get('/geoapify/geocode', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: 'Missing search query' });
      return;
    }

    const response = await geoapifyClient.get('/search', {
      params: { text: q },
    });

    const results = response.data?.results || [];
    if (results.length === 0) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const place = results[0];
    res.json({
      name: place.name || q,
      formatted: place.formatted,
      lat: place.lat,
      lon: place.lon,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error(`geocode API error: ${message}`);
    res.status(500).json({ error: 'Failed to geocode location' });
  }
});

router.get('/geoapify/reverse', async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat as string;
    const lng = req.query.lng as string;
    if (!lat || !lng) {
      res.status(400).json({ error: 'Missing lat/lng' });
      return;
    }

    const response = await geoapifyClient.get('/reverse', {
      params: { lat, lon: lng },
    });

    const results = response.data?.results || [];
    if (results.length === 0) {
      res.json({ name: `${lat}, ${lng}`, formatted: `${lat}, ${lng}` });
      return;
    }

    const place = results[0];
    res.json({
      name: place.name || place.street || place.formatted,
      formatted: place.formatted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error(`reverse geocode error: ${message}`);
    res.json({ name: `${req.query.lat}, ${req.query.lng}`, formatted: '' });
  }
});

router.get('/geoapify/autocomplete', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: 'Missing search query' });
      return;
    }

    const response = await geoapifyClient.get('/autocomplete', {
      params: { text: q },
    });

    res.json(response.data?.results || []);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Autocomplete API error:', message);
    res.status(500).json({ error: 'Failed to fetch autocomplete suggestions' });
  }
});

export default router;
