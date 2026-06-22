'use strict';

// Apply the raw_scraped_context migration directly to the remote Supabase DB
// via the Supabase database SQL HTTP API.
// This avoids `supabase db push` (which re-runs all migrations and can fail
// on ownership errors for storage.objects RLS policies).

const fs = require('fs');

// Load .env.local
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
  console.error('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.error('REF:', REF);
  process.exit(1);
}

const SQL = `
alter table public.total_medications
  add column if not exists raw_scraped_context text;

comment on column public.total_medications.raw_scraped_context is
  'Labelled clinical section text scraped from nzf.org.nz monograph pages (Drug action, Cautions, Adverse effects, Dosing regimen, etc.). Used as RAG input context for educational content generation via GLM-5.2. NULL when no NZF monograph was found or scraping was skipped.';
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
  const txt = await res.text();
  console.log('status:', res.status);
  console.log('response:', txt);
})();