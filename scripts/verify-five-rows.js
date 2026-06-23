'use strict';

// Verify that the 5 medications enriched by the --limit 5 live run actually
// have their educational columns populated in Supabase.

const fs = require('fs');
try {
  const t = fs.readFileSync('.env.local', 'utf8');
  t.split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env.local */ }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const FIELDS = [
  'drug_class',
  'why_it_is_prescribed',
  'what_it_does_in_the_body',
  'what_organ_or_condition_it_protects',
  'what_happens_if_you_stop_it',
  'common_dose_range',
  'side_effects',
  'what_symptoms_to_watch_for',
  'when_to_seek_help',
];

(async () => {
  // Supabase REST API — no SDK dependency needed.
  const ids = '1833,1834,1402,1899,1901';
  const select = ['id', 'medication_name', ...FIELDS].join(',');
  const url = `${URL}/rest/v1/total_medications?id=in.(${ids})&select=${encodeURIComponent(select)}`;
  const res = await fetch(url, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
  });
  console.log('status:', res.status);
  const rows = await res.json();
  if (!Array.isArray(rows)) {
    console.log('response:', JSON.stringify(rows).slice(0, 500));
    return;
  }
  console.log(`Got ${rows.length} rows.\n`);
  for (const r of rows) {
    console.log(`--- id ${r.id} : ${r.medication_name}`);
    for (const f of FIELDS) {
      const val = r[f];
      const isFilled = typeof val === 'string' && val.trim().length > 0;
      console.log(`  [${isFilled ? 'OK' : 'EMPTY'}] ${f}: ${isFilled ? `"${val.slice(0, 80)}${val.length > 80 ? '…' : ''}" (${val.length} chars)` : 'null'}`);
    }
    console.log('');
  }
})();