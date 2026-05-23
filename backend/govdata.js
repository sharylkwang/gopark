const axios = require('axios');
require('dotenv').config();

const api_url =
  'https://data.gov.sg/api/action/datastore_search?resource_id=d_23f946fa557947f93a8043bbef41dd09';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('--- Sync Started ---');

  try {
    let alltherecords = [];
    let offset = 0;
    const limit = 500;

    while (true) {
      const url = `${api_url}&limit=${limit}&offset=${offset}`;

      console.log(`Fetching offset ${offset}...`);

      const res = await axios.get(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      const records = res.data?.result?.records || [];

      alltherecords.push(...records);

      console.log(`Fetched ${records.length} records from this page.`);

      await sleep(1500);

      if (records.length < limit) {
        break;
      }

      offset += limit;
    }

    console.log(alltherecords);
    console.log(`Fetched ${alltherecords.length} records total.`);
  } catch (err) {
    console.error('Sync failed:', err.message);

    if (err.response) {
      console.error('API response error:', err.response.data);
    }
  } finally {
    console.log('--- Sync Finished ---');
  }
}

main();