require('dotenv').config(); // load keys from .env file
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors()); // allow frontend to call backend
app.use(express.json());

// Get live HDB carpark availability
app.get('/api/parking', async (req, res) => {
  try {
    const res2 = await axios.get(
      'https://api.data.gov.sg/v1/transport/carpark-availability',
      {
        headers: {
          Authorization: process.env.DATAGOVSG_KEY,
        },
      }
    );

    const list = res2.data.items[0].carpark_data;
    let arr = [];

    for (let i = 0; i < list.length; i++) {
      let cp = list[i];
      let info = cp.carpark_info[0];

      let obj = {
        carparkId: cp.carpark_number,
        totalLots: parseInt(info.total_lots) || 0,
        availableLots: parseInt(info.lots_available) || 0,
      };

      arr.push(obj);
    }

    res.json(arr);
  } catch (err) {
    console.log('parking api error:', err.message);
    res.status(500).json({ error: 'cannot get parking data' });
  }
});

// Convert destination text into lat/lon using Geoapify
app.get('/api/geocode', async (req, res) => {
  try {
    const searchText = req.query.q;

    if (!searchText) {
      return res.status(400).json({ error: 'missing search query' });
    }

    const url =
      `https://api.geoapify.com/v1/geocode/search?` +
      `text=${encodeURIComponent(searchText)}` +
      `&filter=countrycode:sg` +
      `&format=json` +
      `&apiKey=${process.env.GEOAPIFY_KEY}`;

    const response = await axios.get(url);
    const results = response.data?.results || [];

    if (results.length === 0) {
      return res.status(404).json({ error: 'location not found' });
    }

    const place = results[0];

    res.json({
      name: place.name || searchText,
      formatted: place.formatted,
      lat: place.lat,
      lon: place.lon,
    });
  } catch (err) {
    console.log('geocode api error:', err.message);
    res.status(500).json({ error: 'cannot geocode location' });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('started on port 3000');
});