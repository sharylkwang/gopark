import { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';

const router = Router();

router.get('/geocode', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: 'Missing search query' });
      return;
    }

    const response = await axios.get('https://api.geoapify.com/v1/geocode/search', {
      params: {
        text: q,
        filter: 'countrycode:sg',
        format: 'json',
        apiKey: process.env.GEOAPIFY_KEY,
      },
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
    console.error('Geocode API error:', message);
    res.status(500).json({ error: 'Failed to geocode location' });
  }
});

export default router;
