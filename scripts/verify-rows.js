'use strict';
const fs = require('fs');
try {
  const txt = fs.readFileSync('.env.local', 'utf8');
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

(async () => {
  const res = await fetch(
    `${URL}/rest/v1/total_medications?select=id,medication_name,drug_class,why_it_is_prescribed,what_it_does_in_the_body,what_organ_or_condition_it_protects,side_effects,raw_scraped_context&raw_scraped_context=not.is.null&order=medication_name.asc&limit=10`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  const rows = await res.json();
  console.log('status:', res.status);
  console.log('rows with raw_scraped_context:');
  rows.forEach((r) => {
    console.log(`  ${r.id} | ${r.medication_name} | drug_class=${r.drug_class || '(blank)'} | scraped=${r.raw_scraped_context ? r.raw_scraped_context.length + ' chars' : 'null'}`);
  });
})();