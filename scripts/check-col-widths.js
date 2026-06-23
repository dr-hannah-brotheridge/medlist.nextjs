'use strict';

// Query live Supabase for the data type + character_maximum_length of each
// of the 9 educational columns so we know the real VARCHAR limits.

const fs = require('fs');
try {
  const txt = fs.readFileSync('.env.local', 'utf8');
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env.local */ }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = (URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

if (!REF || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SQL = `
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'total_medications'
  AND column_name IN (
    'drug_class',
    'why_it_is_prescribed',
    'what_it_does_in_the_body',
    'what_organ_or_condition_it_protects',
    'what_happens_if_you_stop_it',
    'common_dose_range',
    'side_effects',
    'what_symptoms_to_watch_for',
    'when_to_seek_help'
  )
ORDER BY ordinal_position;
`;

(async () => {
  const url = `https://${REF}.supabase.co/pg/exec`;
  console.log('POST', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  console.log('status:', res.status);
  const body = await res.text();
  console.log('response:', body);
})();