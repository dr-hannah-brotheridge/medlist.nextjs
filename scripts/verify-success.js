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
    `${URL}/rest/v1/total_medications?select=id,medication_name,drug_class,why_it_is_prescribed,what_it_does_in_the_body,what_organ_or_condition_it_protects,what_happens_if_you_stop_it,common_dose_range,side_effects,what_symptoms_to_watch_for,when_to_seek_help&drug_class=not.is.null&order=medication_name.asc&limit=20`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  const rows = await res.json();
  console.log('status:', res.status);
  console.log('rows with drug_class filled (successful enrichments):');
  rows.forEach((r) => {
    const filled = [r.drug_class, r.why_it_is_prescribed, r.what_it_does_in_the_body, r.what_organ_or_condition_it_protects, r.what_happens_if_you_stop_it, r.common_dose_range, r.side_effects, r.what_symptoms_to_watch_for, r.when_to_seek_help].filter((v) => v && String(v).trim()).length;
    console.log(`  ${r.id} | ${r.medication_name} | ${filled}/9 keys | drug_class=${r.drug_class}`);
  });
})();