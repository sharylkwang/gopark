const checks = [
  {
    name: 'GEOAPIFY_KEY',
    required: true,
    async run(key) {
      const url = `https://api.geoapify.com/v1/geocode/search?text=Singapore&limit=1&format=json&apiKey=${key}`;
      const res = await fetch(url);
      if (res.status === 401) throw new Error('rejected (401)');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body.results?.length) throw new Error('no results returned');
      return 'geocoded Singapore';
    },
  },
  {
    name: 'DATAGOVSG_KEY',
    required: true,
    async run(key) {
      const res = await fetch('https://api.data.gov.sg/v1/transport/carpark-availability', {
        headers: { 'x-api-key': key },
      });
      if (res.status === 401 || res.status === 403) throw new Error(`rejected (${res.status})`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const count = body.items?.[0]?.carpark_data?.length ?? 0;
      if (!count) throw new Error('empty availability payload');
      return `${count} carparks live`;
    },
  },
  {
    name: 'DATAMALL_API',
    required: true,
    async run(key) {
      const res = await fetch('https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2', {
        headers: { AccountKey: key, Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) throw new Error(`rejected (${res.status})`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!Array.isArray(body.value)) throw new Error('unexpected response shape');
      return `${body.value.length} records`;
    },
  },
  {
    name: 'GOOGLE_MAPS_KEY',
    required: false,
    async run(key) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Singapore&key=${key}`);
      const body = await res.json();
      if (body.status !== 'OK') throw new Error(body.error_message || body.status);
      return 'geocode OK';
    },
  },
  {
    name: 'ZHIPUAI_API_KEY',
    required: false,
    async run(key) {
      const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.ZHIPUAI_MODEL || 'glm-4-flash',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      if (res.status === 401) throw new Error('rejected (401)');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'chat reachable';
    },
  },
];

const results = await Promise.all(
  checks.map(async (check) => {
    const key = process.env[check.name];
    if (!key) return { check, status: check.required ? 'fail' : 'skip', detail: 'not set' };
    try {
      const detail = await check.run(key.trim());
      return { check, status: 'ok', detail };
    } catch (err) {
      return { check, status: 'fail', detail: err.message };
    }
  })
);

const mark = { ok: '✓', fail: '✗', skip: '–' };
let failed = false;

console.log('\nAPI key verification\n');
for (const { check, status, detail } of results) {
  if (status === 'fail' && check.required) failed = true;
  const tag = check.required ? 'required' : 'optional';
  console.log(`  ${mark[status]}  ${check.name.padEnd(18)} ${status.toUpperCase().padEnd(5)} ${tag.padEnd(9)} ${detail}`);
}
console.log('');

if (failed) {
  console.error('One or more required keys failed. Fix them before deploying.\n');
  process.exit(1);
}
console.log('All required keys verified.\n');
