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

router.get('/govsg/carparks', async (req: Request, res: Response) => {
  try {
    const searchLat = parseFloat(req.query.lat as string);
    const searchLng = parseFloat(req.query.lng as string);

    if (isNaN(searchLat) || isNaN(searchLng)) {
      res.status(400).json({ error: 'Missing valid lat/lng parameters' });
      return;
    }

    // 1. Fetch from the NEW LTA DataMall v2 Endpoint (Page 32 of PDF)
    const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2', {
      headers: { AccountKey: process.env.LTA_DATAMALL_KEY || '' }, // Uses AccountKey (Page 8 of PDF)
    });
    
    // LTA OData puts the array inside a "value" property
    const allCarparks = response.data.value;

    // 2. Map the new LTA data structure and calculate distance
    const processedCarparks = allCarparks.map((cp: any) => {
      // Parse the "Location" string (e.g., "1.29375 103.85718") into numbers
      const coords = cp.Location ? cp.Location.split(' ') : ['0', '0'];
      const cpLat = parseFloat(coords[0]);
      const cpLng = parseFloat(coords[1]);

      // Simple distance math to find out how close it is to the searched destination
      const distance = Math.hypot(cpLat - searchLat, cpLng - searchLng);

      return {
        id: cp.CarParkID,
        name: cp.Development || `Carpark ${cp.CarParkID}`, // Real Mall Name!
        price: 2.00, // Still mock until DB is hooked up
        lots: parseInt(cp.AvailableLots) || 0, // Real live lot count!
        type: cp.Agency === 'LTA' ? 'Commercial' : 'HDB',
        lat: cpLat,
        lng: cpLng,
        distance: distance, // Used for sorting below
        walkTime: Math.max(1, Math.floor(distance * 1000)), // Rough estimate
        weekday: '$2.00 / hr',
        weekend: '$2.50 / hr'
      };
    });

    // 3. Sort by closest distance and only send the top 15 to React
    const closestCarparks = processedCarparks
      .filter((cp: any) => cp.lat !== 0) // Filter out bad data
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 15);

    res.json(closestCarparks);

  } catch (err) {
    console.error('Carparks API error:', err);
    res.status(500).json({ error: 'Failed to fetch carpark data' });
  }
});

export default router;
