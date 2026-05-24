import { Router } from 'express';
import type { Request, Response } from 'express';
import axios from 'axios';

const router = Router();

interface CarparkInfo {
  total_lots: string;
  lots_available: string;
}

interface CarparkData {
  carpark_number: string;
  carpark_info: CarparkInfo[];
}

router.get('/parking', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(
      'https://api.data.gov.sg/v1/transport/carpark-availability',
      { headers: { Authorization: process.env.DATAGOVSG_KEY } }
    );

    const carparks = response.data.items[0].carpark_data.map((cp: CarparkData) => ({
      carparkId: cp.carpark_number,
      totalLots: parseInt(cp.carpark_info[0].total_lots) || 0,
      availableLots: parseInt(cp.carpark_info[0].lots_available) || 0,
    }));

    res.json(carparks);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Parking API error:', message);
    res.status(500).json({ error: 'Failed to fetch parking data' });
  }
});

export default router;
