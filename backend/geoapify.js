const axios = require('axios');
require('dotenv').config();

const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;

async function main() {
  console.log('--- Geoapify search starting ---');

  try {
    if (!GEOAPIFY_KEY) {
      console.error('GEOAPIFY_KEY missing from .env');  
      return;
    }

    const searchText = process.argv[2];

    if (!searchText) {
      console.error('Please provide a search term.');
      return;
    }

    console.log(`Searching for: ${searchText}`);

    const url =
      `https://api.geoapify.com/v1/geocode/search?` +
      `text=${encodeURIComponent(searchText)}` +
      `&filter=countrycode:sg` +
      `&format=json` +
      `&apiKey=${GEOAPIFY_KEY}`;

    const res = await axios.get(url);

    const results = res.data?.results || [];

    console.log(`Found ${results.length} results.`);

    for (const place of results) {
      console.log({
        name: place.name,
        formatted: place.formatted,
        lat: place.lat,
        lon: place.lon,
      });
    }
  } catch (err) {
    console.error('Geoapify failed:', err.message);

    if (err.response) {
      console.error('API response error:', err.response.data);
    }
  } finally {
    console.log('--- Geoapify search is completed ---');
  }
}

main();