'use strict';

// Apply the 20260623_000002 migration (widen 9 educational columns from
// VARCHAR(100) to TEXT) directly to the remote Supabase DB via the pg/exec
// HTTP API. Reuses the same pattern as apply-migration.js.

const fs = require('fs');

try {
  const txt = fs.readFileSync('.env.local', 'utf8');
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* no .env.local */ }

const PROJECT_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
const REF = process.env.SUPABASE_PROJECT_REF || (PROJECT_REF ? PROJECT_REF[1] : '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!REF || !KEY) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SQL = `
-- Drop the dependent view.
DROP VIEW IF EXISTS public.medications_by_name;

-- Widen all 9 columns to TEXT.
ALTER TABLE public.total_medications
  ALTER COLUMN drug_class TYPE TEXT,
  ALTER COLUMN why_it_is_prescribed TYPE TEXT,
  ALTER COLUMN what_it_does_in_the_body TYPE TEXT,
  ALTER COLUMN what_organ_or_condition_it_protects TYPE TEXT,
  ALTER COLUMN what_happens_if_you_stop_it TYPE TEXT,
  ALTER COLUMN common_dose_range TYPE TEXT,
  ALTER COLUMN side_effects TYPE TEXT,
  ALTER COLUMN what_symptoms_to_watch_for TYPE TEXT,
  ALTER COLUMN when_to_seek_help TYPE TEXT;

-- Recreate the view.
CREATE OR REPLACE VIEW public.medications_by_name AS
SELECT id,
    medication_name,
    drug_class,
    why_it_is_prescribed,
    what_it_does_in_the_body,
    what_organ_or_condition_it_protects,
    what_happens_if_you_stop_it,
    common_dose_range,
    side_effects,
    what_symptoms_to_watch_for,
    when_to_seek_help,
    brands
FROM total_medications
ORDER BY medication_name;

-- Restore permissions.
GRANT SELECT ON public.medications_by_name TO anon;
GRANT SELECT ON public.medications_by_name TO authenticated;
`;

(async () => {
  const url = `https://${REF}.supabase.co/pg/exec`;
  console.log('POST', url);
  console.log('Applying migration to widen 9 educational columns to TEXT...');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  const txt = await res.text();
  console.log('status:', res.status);
  console.log('response:', txt);
})();