import 'dotenv/config';
import axios from 'axios';

const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;

async function main() {
  const searchText = process.argv[2];

  if (!GEOAPIFY_KEY) {
    console.error('GEOAPIFY_KEY missing from .env');
    process.exit(1);
  }

  if (!searchText) {
    console.error('Usage: npx tsx scripts/geoapify.ts <search-term>');
    process.exit(1);
  }

  try {
    const response = await axios.get('https://api.geoapify.com/v1/geocode/search', {
      params: {
        text: searchText,
        filter: 'countrycode:sg',
        format: 'json',
        apiKey: GEOAPIFY_KEY,
      },
    });

    const results = response.data?.results || [];
    console.log(`Found ${results.length} results for "${searchText}"`);

    for (const place of results) {
      console.log({
        name: place.name,
        formatted: place.formatted,
        lat: place.lat,
        lon: place.lon,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Geoapify failed:', message);
  }
}

main();
