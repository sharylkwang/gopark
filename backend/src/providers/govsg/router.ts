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

router.get('/govsg/parking', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get('https://api.data.gov.sg/v1/transport/carpark-availability', {
      headers: { Authorization: process.env.DATAGOVSG_KEY },
    });

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

router.get('/govsg/carparks', async (req: Request, res: Response) => {
  try {
    const searchLat = parseFloat(req.query.lat as string);
    const searchLng = parseFloat(req.query.lng as string);

    if (isNaN(searchLat) || isNaN(searchLng)) {
      res.status(400).json({ error: 'Missing valid lat/lng parameters' });
      return;
    }

    const response = await axios.get('https://api.data.gov.sg/v1/transport/carpark-availability', {
      headers: { Authorization: process.env.DATAGOVSG_KEY || '' },
    });
    
    const liveData = response.data.items[0].carpark_data;
    const formattedResults = liveData.slice(0, 15).map((cp: CarparkData, index: number) => {
      
      const randomLatOffset = (Math.random() - 0.5) * 0.008;
      const randomLngOffset = (Math.random() - 0.5) * 0.008;

      return {
        id: cp.carpark_number,
        name: `LTA Carpark ${cp.carpark_number}`,
        price: 2.00 + (index * 0.50), 
        walkTime: 2 + (index % 5),
        lots: parseInt(cp.carpark_info[0].lots_available) || 0, 
        type: index % 3 === 0 ? 'Flat Rate' : 'Hourly',
        lat: searchLat + randomLatOffset,
        lng: searchLng + randomLngOffset,
        weekday: '$2.00 / hr',
        weekend: '$2.50 / hr'
      };
    });

    res.json(formattedResults);
  } catch (err) {
    console.error('Carparks API error:', err);
    res.status(500).json({ error: 'Failed to fetch carpark data' });
  }
});

export default router;
