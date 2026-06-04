const BASE = process.env.BASE_URL || 'http://localhost:3000';
const FULL = process.argv.includes('--full');
const url = `${BASE}/api/carparks/scrape${FULL ? '?full=true' : ''}`;

function line(s = '') { process.stdout.write(s + '\n'); }

async function main() {
  line(`POST ${url}`);
  const t0 = Date.now();

  let res;
  try {
    res = await fetch(url, { method: 'POST' });
  } catch (e) {
    line(`FAIL - backend unreachable at ${BASE}: ${e.message}`);
    process.exit(1);
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    line(`FAIL - HTTP ${res.status} after ${secs}s`);
    line(await res.text());
    process.exit(1);
  }

  const data = await res.json();
  line(`OK - ${secs}s | sources=${data.sources} carparks=${data.carparks}`);

  if (!data.carparks) {
    line('WARN - scrape returned 0 carparks (search down, no LLM backend, or nothing new)');
    process.exit(0);
  }

  line('');
  line('Sample:');
  for (const cp of data.sample ?? []) {
    line(`- [${cp.source}] ${cp.name}${cp.address ? ` - ${cp.address}` : ''}`);
    for (const r of cp.rates ?? []) {
      const amt = r.amount_dollars != null ? `$${r.amount_dollars}` : '?';
      const per = r.per_minutes ? `/${r.per_minutes}min` : '';
      const when = [r.day_type, r.time_start && r.time_end ? `${r.time_start}-${r.time_end}` : null].filter(Boolean).join(' ');
      line(`    ${amt}${per} ${r.vehicle_type ?? 'car'}${when ? ` (${when})` : ''}`);
    }
  }

  const verify = await fetch(`${BASE}/api/carparks`);
  if (verify.ok) {
    const all = await verify.json();
    line('');
    line(`Active carparks now visible via /api/carparks: ${all.length}`);
  }
}

main().catch(e => { line(`ERROR - ${e.message}`); process.exit(1); });
