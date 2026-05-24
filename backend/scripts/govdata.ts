import 'dotenv/config';
import axios from 'axios';

const API_URL =
  'https://data.gov.sg/api/action/datastore_search?resource_id=d_23f946fa557947f93a8043bbef41dd09';
const LIMIT = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Syncing carpark records from data.gov.sg...');

  try {
    const records: unknown[] = [];
    let offset = 0;

    while (true) {
      const response = await axios.get(API_URL, {
        params: { limit: LIMIT, offset },
        headers: { Accept: 'application/json' },
      });

      const batch = response.data?.result?.records || [];
      records.push(...batch);
      console.log(`  offset ${offset}: ${batch.length} records`);

      if (batch.length < LIMIT) break;
      offset += LIMIT;
      await sleep(1500);
    }

    console.log(`Total: ${records.length} records`);
    console.log(records);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync failed:', message);
  }
}

main();
