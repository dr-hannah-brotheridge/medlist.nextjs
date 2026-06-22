#!/usr/bin/env node
/**
 * import-nzulm.js — NZULM CSV → Supabase seeder (Layers 1 & 3).
 *
 * Parses prescribing_term_selection_list_dump.csv and populates:
 *   - total_medications.medication_name  (generic rows)
 *   - nzulm_lookup.brand_name           (trade rows, linked via generic_medication_id)
 *
 * STRICT DATA-CLEANING RULES (see task spec):
 *   GLOBAL SKIP: drop any row whose prescribing_term contains "[obsolete]".
 *   PASS 1 (generic): truncate at first number/decimal/unit (mg, mcg, g, mL, %),
 *                     trim, capitalise first letter. Batch insert (500).
 *   PASS 2 (trade):  split on FIRST " - " -> [brandSide, genericSide].
 *                     brandSide: strip parenthesised substrings, truncate before
 *                                trailing numbers/slashes, trim.
 *                     genericSide: clean with Pass-1 logic, resolve parent id.
 *                     Batch insert (500) into nzulm_lookup.
 *
 * Usage:
 *   node import-nzulm.js [csvPath] [--dry-run] [--truncate]
 *
 * Env (read from .env.local if present, or process.env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * The script ASSUMES migration 20260622_000002_nzulm_lookup.sql has been applied.
 * Zero npm dependencies - Node 18+ built-ins (fs, path, readline, fetch) only.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BATCH_SIZE = 500;
const DEFAULT_CSV =
  "c:/Users/Lenovo User/Downloads/nzulm_2026_06_v3.9.26.8/prescribing_term_selection_list_dump.csv";

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--")) || DEFAULT_CSV;
const DRY_RUN = args.includes("--dry-run");
const TRUNCATE_FIRST = args.includes("--truncate");

// ---------------------------------------------------------------------------
// Tiny dotenv loader (.env.local) - no dependency.
// ---------------------------------------------------------------------------
function loadEnvFile(file) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set\n" +
      "(in .env.local or environment).",
  );
  process.exit(1);
}

const REST = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: "Bearer " + SERVICE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ---------------------------------------------------------------------------
// CSV line parser - handles quoted fields, embedded commas & escaped quotes.
// ---------------------------------------------------------------------------
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQ = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Cleaning functions (spec Layers 1 & 3)
// ---------------------------------------------------------------------------

/**
 * Pass 1 generic cleaning.
 * Truncate the moment a number / decimal / unit metric is encountered.
 * e.g. "risperidone 1 mg/mL oral liquid" -> "Risperidone".
 */
function cleanGenericName(raw) {
  if (!raw) return "";
  let s = raw;
  // Defensive: strip any trailing [obsolete] marker.
  s = s.replace(/\s*\[obsolete\].*$/i, "");
  // Truncate at first number (with optional decimal/comma groups) + rest of line.
  // Handles "1 mg", "0.5%", "200 mg", "1.66 mL/5 mL", "10 000 international units".
  s = s.replace(/\s+\d+(?:[.,]\d+)*.*$/i, "");
  // Trim trailing punctuation/whitespace left over.
  s = s.replace(/[\s,;:.-]+$/g, "").trim();
  if (!s) return "";
  // Capitalise first letter.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pass 2 brand-side cleaning.
 * Remove parenthesised substrings (manufacturer indicators / propellants).
 * Truncate right before trailing numbers/slashes used for dosing metrics.
 * e.g. "Breztri Aerosphere 160/7.2/5" -> "Breztri Aerosphere".
 *      "Breztri Aerosphere (Slade)"    -> "Breztri Aerosphere".
 */
function cleanBrandSide(raw) {
  if (!raw) return "";
  let s = raw;
  // Remove parenthesised substrings entirely.
  s = s.replace(/\s*\([^)]*\)/g, "");
  // Truncate at the first dosing marker: a trailing number with optional slashes/decimals.
  s = s.replace(/\s+\d.*$/i, "");
  // Catch trailing slash/number residue after the above.
  s = s.replace(/\s+[\d/.\s]+$/, "");
  s = s.replace(/[\s,;:.-]+$/g, "").trim();
  return s;
}

// ---------------------------------------------------------------------------
// PostgREST helpers
// ---------------------------------------------------------------------------
async function restInsert(table, rows, columns) {
  if (!rows.length) return [];
  const colList = columns.join(",");
  const url = REST + "/" + table + "?columns=" + colList;
  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      "POST " + table + " failed " + res.status + ": " + text.slice(0, 500),
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = [];
  }
  return Array.isArray(data) ? data : [];
}

async function restRpc(fnName) {
  const res = await fetch(REST + "/rpc/" + fnName, {
    method: "POST",
    headers: Object.assign({}, HEADERS, { Prefer: "return=minimal" }),
    body: "{}",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(
      "rpc " + fnName + " failed " + res.status + ": " + t.slice(0, 500),
    );
  }
}

async function maybeTruncateLookup() {
  if (!TRUNCATE_FIRST) return;
  console.log("[truncate] clearing nzulm_lookup and total_medications...");
  for (const t of ["nzulm_lookup", "total_medications"]) {
    // PostgREST requires a WHERE clause for DELETE. id=gte.0 matches all rows.
    const res = await fetch(REST + "/" + t + "?id=gte.0", {
      method: "DELETE",
      headers: Object.assign({}, HEADERS, { Prefer: "return=minimal" }),
    });
    if (!res.ok) {
      const t2 = await res.text();
      console.warn(
        "[truncate] " + t + " delete returned " + res.status + ": " + t2.slice(0, 200),
      );
    } else {
      console.log("[truncate] " + t + " cleared.");
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  console.log("=".repeat(70));
  console.log("NZULM Importer");
  console.log("=".repeat(70));
  console.log("CSV        : " + csvPath);
  console.log("Supabase   : " + SUPABASE_URL);
  console.log("Mode       : " + (DRY_RUN ? "DRY RUN (no writes)" : "LIVE"));
  console.log("Truncate   : " + (TRUNCATE_FIRST ? "YES" : "no"));
  console.log("Batch size : " + BATCH_SIZE);
  console.log("-".repeat(70));

  if (!fs.existsSync(csvPath)) {
    console.error("ERROR: CSV not found at " + csvPath);
    process.exit(1);
  }

  if (!DRY_RUN) await maybeTruncateLookup();

  // ---- Stream rows, global skip, split by term_type -----------------------
  const generics = [];
  const trades = [];
  let totalRows = 0;
  let skippedObsolete = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, "utf8"),
    crlfDelay: Infinity,
  });

  let headerSeen = false;
  for await (const line of rl) {
    if (!line) continue;
    if (!headerSeen) {
      headerSeen = true;
      continue; // skip header row
    }
    totalRows++;
    const cols = parseCsvLine(line);
    if (cols.length < 4) continue;
    const concept_id = cols[0] || "";
    const term_type = (cols[1] || "").toLowerCase();
    const description_id = cols[2] || "";
    const prescribing_term = cols[3] || "";
    if (!prescribing_term) continue;
    if (/\[obsolete\]/i.test(prescribing_term)) {
      skippedObsolete++;
      continue;
    }
    const row = { concept_id, term_type, description_id, prescribing_term };
    if (term_type === "generic") generics.push(row);
    else if (term_type === "trade") trades.push(row);
  }

  console.log(
    "Parsed " +
      totalRows +
      " data rows | generics: " +
      generics.length +
      " | trades: " +
      trades.length +
      " | skipped [obsolete]: " +
      skippedObsolete,
  );

  // ---- PASS 1: insert generics -------------------------------------------
  console.log("\n[PASS 1] Cleaning + inserting generics...");
  const cleanedGenerics = [];
  const seenGenericNames = new Set();
  let skippedDupeGeneric = 0;
  for (const g of generics) {
    const name = cleanGenericName(g.prescribing_term);
    if (!name) {
      console.warn("  [skip] empty name for concept_id " + g.concept_id);
      continue;
    }
    if (seenGenericNames.has(name.toLowerCase())) {
      skippedDupeGeneric++;
      continue;
    }
    seenGenericNames.add(name.toLowerCase());
    cleanedGenerics.push({ medication_name: name, concept_id: g.concept_id });
  }

  console.log(
    "  " +
      cleanedGenerics.length +
      " unique cleaned generics (" +
      skippedDupeGeneric +
      " dupes skipped).",
  );

  // In-memory maps for Pass 2 parent resolution.
  const conceptIdToDbId = new Map();
  const nameLcToDbId = new Map();
  // Build concept_id -> cleanedName (lowercase) from CSV input, so we can
  // resolve concept_id -> name -> dbId after insert (since total_medications
  // has no concept_id column — we deliberately didn't add one).
  const conceptIdToNameLc = new Map();
  for (const g of cleanedGenerics) {
    if (g.concept_id)
      conceptIdToNameLc.set(g.concept_id, g.medication_name.toLowerCase());
  }

  if (!DRY_RUN) {
    for (let i = 0; i < cleanedGenerics.length; i += BATCH_SIZE) {
      const batch = cleanedGenerics.slice(i, i + BATCH_SIZE);
      // Insert ONLY medication_name — total_medications has no concept_id column.
      const inserted = await restInsert("total_medications", batch, [
        "medication_name",
      ]);
      for (const r of inserted) {
        const nameLc = (r.medication_name || "").toLowerCase();
        nameLcToDbId.set(nameLc, r.id);
        // Resolve concept_id via the name map (concept_id -> name -> dbId).
        for (const [cid, nl] of conceptIdToNameLc) {
          if (nl === nameLc) conceptIdToDbId.set(cid, r.id);
        }
      }
      process.stdout.write(
        "\r  inserted " +
          Math.min(i + BATCH_SIZE, cleanedGenerics.length) +
          "/" +
          cleanedGenerics.length,
      );
    }
    console.log("");
  } else {
    // dry-run: simulate ids
    let sim = 1;
    for (const g of cleanedGenerics) {
      if (g.concept_id) conceptIdToDbId.set(g.concept_id, sim);
      nameLcToDbId.set(g.medication_name.toLowerCase(), sim);
      sim++;
    }
    console.log("  (dry-run: not writing)");
  }

  // ---- PASS 2: insert trades --------------------------------------------
  console.log("\n[PASS 2] Cleaning + inserting trade brands...");
  const tradeRows = [];
  let unresolvableParent = 0;
  let noHyphen = 0;

  for (const t of trades) {
    const term = t.prescribing_term;
    const hyphenIdx = term.indexOf(" - ");
    let brandSide, genericSide;
    if (hyphenIdx === -1) {
      noHyphen++;
      brandSide = term;
      genericSide = term;
    } else {
      brandSide = term.slice(0, hyphenIdx);
      genericSide = term.slice(hyphenIdx + 3);
    }

    const brand = cleanBrandSide(brandSide);
    if (!brand) continue;

    const genericCleaned = cleanGenericName(genericSide);

    let parentId =
      nameLcToDbId.get(genericCleaned.toLowerCase()) ??
      (t.concept_id ? conceptIdToDbId.get(t.concept_id) : undefined);

    if (!parentId) {
      unresolvableParent++;
      continue;
    }

    tradeRows.push({
      generic_medication_id: parentId,
      brand_name: brand,
      concept_id: t.concept_id,
    });
  }

  console.log(
    "  " +
      tradeRows.length +
      " clean trade rows ready | unresolvable parent: " +
      unresolvableParent +
      " | no-hyphen rows: " +
      noHyphen,
  );

  if (!DRY_RUN && tradeRows.length) {
    for (let i = 0; i < tradeRows.length; i += BATCH_SIZE) {
      const batch = tradeRows.slice(i, i + BATCH_SIZE);
      await restInsert("nzulm_lookup", batch, [
        "generic_medication_id",
        "brand_name",
        "concept_id",
      ]);
      process.stdout.write(
        "\r  inserted " +
          Math.min(i + BATCH_SIZE, tradeRows.length) +
          "/" +
          tradeRows.length,
      );
    }
    console.log("");
  } else if (DRY_RUN) {
    console.log("  (dry-run: not writing)");
  }

  // ---- Backfill total_medications.brands from nzulm_lookup ---------------
  if (!DRY_RUN) {
    console.log(
      "\n[BACKFILL] Refreshing total_medications.brands from nzulm_lookup...",
    );
    try {
      await restRpc("refresh_brands_from_lookup");
      console.log("  brands column refreshed.");
    } catch (e) {
      console.warn(
        "  WARN: Could not call refresh_brands_from_lookup() — did you apply migration 000003?\n" +
          "        " + (e instanceof Error ? e.message : e),
      );
    }
  }

  // ---- Summary -----------------------------------------------------------
  const secs = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n" + "=".repeat(70));
  console.log("DONE");
  console.log("=".repeat(70));
  console.log(
    "Generics inserted : " +
      (DRY_RUN ? "(dry-run)" : cleanedGenerics.length),
  );
  console.log(
    "Trades inserted   : " + (DRY_RUN ? "(dry-run)" : tradeRows.length),
  );
  console.log("Skipped obsolete  : " + skippedObsolete);
  console.log("Skipped dupe gen  : " + skippedDupeGeneric);
  console.log("Unresolvable trade: " + unresolvableParent);
  console.log("Elapsed           : " + secs + "s");

  if (trades.length === 0) {
    console.log(
      "\nNOTE: This CSV dump contained 0 trade rows. nzulm_lookup will remain empty.\n" +
        "      Re-run with a full NZULM dump (including term_type=trade rows) to populate brands.",
    );
  }
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});