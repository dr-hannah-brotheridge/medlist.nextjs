'use strict';

// Deeper diagnostic: search for Insulin, lispro, Humalog across both tables.

const fs = require('fs');
try {
  const t = fs.readFileSync('.env.local', 'utf8');
  t.split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const REST = URL.replace(/\/$/, '') + '/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function searchTable(table, column, term, limit = 20) {
  const pattern = encodeURIComponent(`%${term}%`);
  const selectCol = table === 'nzulm_lookup' ? 'generic_medication_id,brand_name,concept_id' : 'id,medication_name,brands';
  const url = `${REST}/${table}?select=${selectCol}&${column}=ilike.${pattern}&limit=${limit}`;
  const res = await fetch(url, { headers: H });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return [{ error: text.slice(0, 200) }]; }
}

(async () => {
  console.log('=== DEEP DIAGNOSTIC ===\n');

  // 1. Search nzulm_lookup for "Humalog"
  console.log('--- nzulm_lookup: search brand_name for "Humalog" ---');
  const humalogLookup = await searchTable('nzulm_lookup', 'brand_name', 'Humalog');
  if (Array.isArray(humalogLookup) && humalogLookup.length > 0 && !humalogLookup[0].error) {
    humalogLookup.forEach(r => console.log(`  generic_id:${r.generic_medication_id} brand:"${r.brand_name}" concept_id:"${r.concept_id}"`));
  } else {
    console.log('  NO MATCHES or error:', JSON.stringify(humalogLookup).slice(0, 200));
  }

  // 2. Search nzulm_lookup for "Huma" (broader)
  console.log('\n--- nzulm_lookup: search brand_name for "Huma" ---');
  const humaLookup = await searchTable('nzulm_lookup', 'brand_name', 'Huma');
  if (Array.isArray(humaLookup) && humaLookup.length > 0 && !humaLookup[0].error) {
    humaLookup.forEach(r => console.log(`  generic_id:${r.generic_medication_id} brand:"${r.brand_name}"`));
  } else {
    console.log('  NO MATCHES or error:', JSON.stringify(humaLookup).slice(0, 200));
  }

  // 3. Search total_medications for "lispro"
  console.log('\n--- total_medications: search medication_name for "lispro" ---');
  const lisproMeds = await searchTable('total_medications', 'medication_name', 'lispro');
  if (Array.isArray(lisproMeds) && lisproMeds.length > 0 && !lisproMeds[0].error) {
    lisproMeds.forEach(r => console.log(`  id:${r.id} name:"${r.medication_name}" brands:"${r.brands}"`));
  } else {
    console.log('  NO MATCHES or error:', JSON.stringify(lisproMeds).slice(0, 200));
  }

  // 4. Search total_medications for "Insulin" (all insulin entries)
  console.log('\n--- total_medications: search medication_name for "Insulin" ---');
  const insulinMeds = await searchTable('total_medications', 'medication_name', 'Insulin');
  if (Array.isArray(insulinMeds) && insulinMeds.length > 0 && !insulinMeds[0].error) {
    insulinMeds.forEach(r => console.log(`  id:${r.id} name:"${r.medication_name}" brands:"${r.brands}"`));
  } else {
    console.log('  NO MATCHES or error:', JSON.stringify(insulinMeds).slice(0, 200));
  }

  // 5. Search nzulm_lookup for "Humalog" in brand_name
  console.log('\n--- nzulm_lookup: search brand_name for "Oxyn" ---');
  const oxynLookup = await searchTable('nzulm_lookup', 'brand_name', 'Oxyn');
  if (Array.isArray(oxynLookup) && oxynLookup.length > 0 && !oxynLookup[0].error) {
    oxynLookup.forEach(r => console.log(`  generic_id:${r.generic_medication_id} brand:"${r.brand_name}"`));
  } else {
    console.log('  NO MATCHES or error:', JSON.stringify(oxynLookup).slice(0, 200));
  }

  // 6. Search total_medications for "Oxycodone"
  console.log('\n--- total_medications: search medication_name for "Oxycodone" ---');
  const oxyMeds = await searchTable('total_medications', 'medication_name', 'Oxycodone');
  if (Array.isArray(oxyMeds) && oxyMeds.length > 0 && !oxyMeds[0].error) {
    oxyMeds.forEach(r => console.log(`  id:${r.id} name:"${r.medication_name}" brands:"${r.brands}"`));
  } else {
    console.log('  NO MATCHES or error:', JSON.stringify(oxyMeds).slice(0, 200));
  }

  console.log('\n=== DONE ===');
})();