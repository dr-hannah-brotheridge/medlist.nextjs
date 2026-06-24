#!/usr/bin/env node
/**
 * build-educational-db.js — NeuralWatt GLM-5.2 -> Supabase educational backfill.
 *
 * Loops every generic medication in `total_medications` whose 9 clinical
 * layout columns (see EDUCATIONAL_FIELDS) are partly/fully blank, asks
 * NeuralWatt GLM-5.2 (OpenAI-compatible API) for a brief JSON block per
 * medication, and writes the parsed strings back via targeted Supabase
 * `.update()` transactions.
 *
 * Idempotent: the read filter only selects rows with at least one blank
 * clinical field, so re-running skips fully-populated medications.
 *
 * Concurrency: an async pool (default 10, via `p-limit`) keeps NeuralWatt's
 * internal prompt cache hot and the pipeline energy-efficient.
 *
 * Resilience: each medication is processed inside its own try/catch; a single
 * parse/validation failure never aborts the run.
 *
 * Usage:
 *   node scripts/build-educational-db.js [--dry-run] [--limit N] [--concurrency K] [--no-scrape] [--no-db-cap] [--re-scrape]
 *
 * Env (read from .env.local / .env if present, else process.env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEURALWATT_BASE_URL     (OpenAI-compatible base, e.g. https://api.neuralwatt.com/v1)
 *   NEURALWATT_API_KEY
 *   NEURALWATT_MODEL        (default GLM-5.2)
 *
 * NOTE on column #4: the live Supabase schema + entire frontend codebase use
 * `what_organ_or_condition_it_protects` (the task spec wrote `_targets`, which
 * does not exist in the DB and would be silently ignored by PostgREST). We
 * therefore target the real column name so data actually persists.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const { createClient } = require("@supabase/supabase-js");
const { OpenAI } = require("openai");
const pLimitImported = require("p-limit");
const pLimit = typeof pLimitImported === "function" ? pLimitImported : pLimitImported.default;
const { scrapeNzfForMedication } = require("./lib/nzf-scraper");

// ---------------------------------------------------------------------------
// Config / CLI
// ---------------------------------------------------------------------------
const EDUCATIONAL_FIELDS = [
  "drug_class",
  "why_it_is_prescribed",
  "what_it_does_in_the_body",
  // Live DB column (NOT `_targets` — see header note).
  "what_organ_or_condition_it_protects",
  "what_happens_if_you_stop_it",
  "common_dose_range",
  "side_effects",
  "what_symptoms_to_watch_for",
  "when_to_seek_help",
];

const SELECT_COLUMNS = ["id", "medication_name", ...EDUCATIONAL_FIELDS, "raw_scraped_context"].join(",");

// Hard length guardrail — enforces the "few sentences" brevity constraint even
// if the model occasionally over-generates.
const MAX_FIELD_CHARS = 600;
// Supabase schema guardrail: the live DB types these 9 columns as
// character varying(100) (see migration 20260623_000002 for the TEXT fix).
// Until that migration is applied, any value > 100 chars fails the whole
// .update() with "value too long for type character varying(100)". We cap
// defensively to 95 chars (leaving headroom for the "…" ellipsis) so writes
// land immediately. Override with `--no-db-cap` after widening to TEXT.
const DB_VARCHAR_CAP = 95;
// GLM-5.2 is a reasoning/thinking model — 8192 tokens gives the JSON output
// ample room before hitting the cap. Overridable via env for experimentation.
const MAX_TOKENS = Number(process.env.NEURALWATT_MAX_TOKENS) || 8192;
const PAGE_SIZE = 1000;
const DEFAULT_CONCURRENCY = 10;
const MAX_RETRIES = 2;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const NO_SCRAPE = args.includes("--no-scrape");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? Number(args[limitIdx + 1]) || 0 : 0;
const concIdx = args.indexOf("--concurrency");
const CONCURRENCY =
  concIdx !== -1 ? Number(args[concIdx + 1]) || DEFAULT_CONCURRENCY : DEFAULT_CONCURRENCY;
const SCRAPE_CONCURRENCY = 3;
const MAX_FIELD_CHARS_CLI = (() => {
  const i = args.indexOf("--max-chars");
  return i !== -1 ? Number(args[i + 1]) || MAX_FIELD_CHARS : MAX_FIELD_CHARS;
})();
// When true, skip the DB_VARCHAR_CAP (use after applying migration
// 20260623_000002 to widen the columns to TEXT).
const NO_DB_CAP = args.includes("--no-db-cap");
// When true, re-scrape rows previously cached as NOT_IN_NZF (the old exact-
// match scraper missed real drugs like Enalapril/Diltiazem). This flag targets
// those rows, clears the cached marker, and re-scrapes with the fixed fuzzy
// matcher. Rows that still return null are re-marked NOT_IN_NZF.
const RE_SCRAPE = args.includes("--re-scrape");
// When set, force re-scrape of medications whose name contains the given
// substring (case-insensitive), ignoring cached raw_scraped_context AND the
// default blank-field filter. Clears the 9 educational fields so they get
// re-enriched with the new (possibly multi-monograph) context. Use to fix
// dual-use drugs like methotrexate whose cached context was only one side.
// Example: --re-scrape-name "methotrexate"
const RE_SCRAPE_NAME_IDX = args.indexOf("--re-scrape-name");
const RE_SCRAPE_NAME =
  RE_SCRAPE_NAME_IDX !== -1 ? args[RE_SCRAPE_NAME_IDX + 1] || "" : "";
// When true, re-scrape ALL rows that have cached raw_scraped_context (excluding
// NOT_IN_NZF). Smartly skips the GLM re-enrichment unless the new scrape found
// multi-monograph content (detected via "=== NZF MONOGRAPH 2/" marker) or the
// text changed substantially — saving API tokens on the many drugs that only
// have one monograph (whose re-scrape is byte-identical to the cache).
const RE_SCRAPE_ALL_CACHED = args.includes("--re-scrape-all-cached");

// ---------------------------------------------------------------------------
// Tiny dotenv loader (mirrors import-nzulm.js — zero dependencies).
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
const NEURALWATT_BASE_URL =
  process.env.NEURALWATT_BASE_URL || "https://api.neuralwatt.com/v1";
const NEURALWATT_API_KEY = process.env.NEURALWATT_API_KEY || "";
const NEURALWATT_MODEL = process.env.NEURALWATT_MODEL || "GLM-5.2";

// ---------------------------------------------------------------------------
// Clinical system prompt for callGlm — explicit 9-key NZF translation table.
// The numbered mapping ties each DB column to a concrete section of the raw
// NZF source text so GLM-5.2 cannot anchor only on `drug_class` and leave the
// other 8 keys blank (schema choice paralysis). Key #4 uses the live DB column
// name `what_organ_or_condition_it_protects` (NOT `_targets`, which PostgREST
// would silently ignore — see file header note). Key #5 is
// `what_happens_if_you_stop_it` (matches EDUCATIONAL_FIELDS exactly).
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = [
  "You are a strict data mapper. Translate the provided raw NZF source text into the required 9-key JSON structure by following this exact mapping guide:",
  "",
  "1. `drug_class`: Look at the top classification of the drug or its mechanism in the text. Summarize into 2-5 words (e.g., 'ACE Inhibitor').",
  "2. `why_it_is_prescribed`: Map this directly to the 'Indications' or 'Uses' section of the NZF text.",
  "3. `what_it_does_in_the_body`: Map this to the drug's mechanism of action or therapeutic effects described in the text.",
  "4. `what_organ_or_condition_it_protects`: Identify the main organ (e.g., heart, kidneys) or disease state mentioned in the Indications/Dose sections.",
  "5. `what_happens_if_you_stop_it`: If not explicitly stated, write a standard clinical warning based on the indication (e.g., for blood pressure: 'Your blood pressure may rise again. Do not stop without consulting your doctor.').",
  "6. `common_dose_range`: Map this directly to the 'Dose' section of the NZF text. Keep it brief.",
  "7. `side_effects`: Map this directly to the 'Side-effects' section of the NZF text. Summarize the most common ones.",
  "8. `what_symptoms_to_watch_for`: Look at the 'Side-effects' and 'Cautions/Warnings' sections. Extract 2-3 key physical symptoms the patient can physically feel or see.",
  "9. `when_to_seek_help`: Map this to the 'Severe side-effects', 'Stop taking immediately', or urgent warning phrases in the text.",
  "",
  "CRITICAL EXECUTION RULES:",
  "- Every single key MUST return a valid, non-empty string.",
  "- Do not leave any key as \"\" or null.",
    "- Write each explanation in exactly 1 to 2 short sentences at a 6th-grade reading level for an elderly patient. Eliminate dense medical jargon (e.g., write 'shortness of breath' instead of 'dyspnea').",
  "- If a section is completely missing from the raw text, use this standard placeholder: 'Please consult your pharmacist or doctor for specific guidance on this medication.'",
  "- MULTIPLE MONOGRAPHS: Some medications have 2+ NZF monographs (one per therapeutic use, marked '=== NZF MONOGRAPH 1/2 ===', '=== NZF MONOGRAPH 2/2 ===', etc.). When more than one is supplied, SYNTHESISE across ALL of them — do not anchor on only the first. For example, methotrexate is both an antineoplastic (cancer) and an autoimmune agent (rheumatoid arthritis); both uses must be reflected in `why_it_is_prescribed`, `common_dose_range`, and `side_effects`.",
  "",
  "FORMATTING: Return ONLY a raw, valid JSON object with these exact 9 keys (and no others):",
  JSON.stringify(EDUCATIONAL_FIELDS, null, 2),
  "Do not wrap the JSON in Markdown code blocks (such as ```json) or add introductory/concluding conversational text.",
  "",
  "When no authoritative NZF source text is supplied for a medication in the user message, you are instructed to act AS the authoritative New Zealand Formulary (NZF) resource baseline and generate the accurate medical parameters internally for that specific medication name, still obeying every constraint above.",
].join("\n");

// ---------------------------------------------------------------------------
// Specialized system prompt for items NOT in the NZF (devices, condoms,
// amino acid formulas, supplements, etc.). Prevents hallucination by
// constraining GLM to a safe device/consumable classification + disclaimer.
// ---------------------------------------------------------------------------
const NOT_IN_NZF_MARKER = "NOT_IN_NZF";

const DEVICE_SYSTEM_PROMPT = [
  "You are a Medical Translation Interface for a patient-facing mobile PWA.",
  "The item provided does NOT have a clinical monograph in the New Zealand Formulary (NZF).",
  "It is likely a medical device, consumable, supplement, or specialist formulation.",
  "",
  "Your task: classify this item and return a simplified but safe JSON object.",
  "",
  "Rules:",
  "1. Set `drug_class` to \"Medical Supply / Device\" if the item is a physical product (e.g. needle, condom, dressing, catheter) OR \"Specialist Formulation\" if it is a nutritional/supplement compound (e.g. amino acids, vitamins, electrolyte solutions).",
  "2. For `why_it_is_prescribed`, briefly state the item's purpose if known (1-2 sentences max), otherwise use the standard disclaimer below.",
  "3. For ALL remaining fields, use this exact value: \"This item does not have standard NZF clinical drug entries. Please follow specific package instructions or consult your healthcare provider.\"",
  "4. Return ONLY a raw JSON object with these exact 9 keys (and no others):",
  JSON.stringify(EDUCATIONAL_FIELDS, null, 2),
].join("\n");

// ---------------------------------------------------------------------------
// NZF local source file handling (task §3).
// ---------------------------------------------------------------------------
const NZF_CANDIDATES = [
  "nzf-source.json",
  "nzf-source.csv",
  "nzf.json",
  "nzf.csv",
  "nz_formulary.json",
  "nz_formulary.csv",
  "data/nzf-source.json",
  "data/nzf.json",
];

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
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else if (ch === '"') {
      inQ = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Build { lowercasedName -> rawSourceText } from a local NZF file, or null. */
function loadNzfSourceMap() {
  for (const rel of NZF_CANDIDATES) {
    const p = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, "utf8");
      const map = new Map();
      const ext = path.extname(rel).toLowerCase();
      if (ext === ".json") {
        const arr = JSON.parse(raw);
        for (const row of Array.isArray(arr) ? arr : []) {
          const name =
            row.medication_name || row.name || row.generic_name || row.term;
          if (!name) continue;
          map.set(String(name).toLowerCase().trim(), JSON.stringify(row));
        }
      } else {
        // CSV: first column is the medication name; rest is the raw source text.
        const lines = raw.split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          const cols = parseCsvLine(line);
          if (!cols[0] || /^medication/i.test(cols[0])) continue; // header
          const name = cols[0];
          map.set(name.toLowerCase().trim(), cols.slice(1).join(" "));
        }
      }
      console.log(`[nzf] Loaded ${map.size} source rows from ${rel}`);
      return map;
    } catch (e) {
      console.warn(`[nzf] Failed to parse ${rel}: ${e.message}`);
    }
  }
  return null;
}

const NZF_MAP = loadNzfSourceMap();

// ---------------------------------------------------------------------------
// OpenAI-compatible client pointed at NeuralWatt.
// ---------------------------------------------------------------------------
const neuralwatt = NEURALWATT_API_KEY
  ? new OpenAI({ baseURL: NEURALWATT_BASE_URL, apiKey: NEURALWATT_API_KEY })
  : null;

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isBlank(v) {
  return v == null || String(v).trim() === "";
}

function rowNeedsEnrichment(row) {
  return EDUCATIONAL_FIELDS.some((f) => isBlank(row[f]));
}

/** Strip accidental ```json fences / surrounding prose and parse.
 *  Includes a repair fallback that closes unterminated strings / braces when
 *  GLM truncates its response at the token cap. */
function parseJsonResponse(text) {
  if (!text) throw new Error("empty response");
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (s.charAt(0) !== "{") {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  }
  try {
    return JSON.parse(s);
  } catch (e) {
    const repaired = repairTruncatedJson(s);
    if (repaired) {
      console.warn(`  [json-repair] salvaged truncated JSON (${s.length} -> ${repaired.length} chars)`);
      return JSON.parse(repaired);
    }
    throw e;
  }
}

function repairTruncatedJson(s) {
  if (!s || s.charAt(0) !== "{") return null;
  let inStr = false, escape = false, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
  }
  let repaired = s.replace(/,\s*$/, "");
  if (inStr) repaired += '"';
  for (let i = 0; i < depth; i++) repaired += "}";
  return depth > 0 ? repaired : null;
}

/** Validate + sanitize the 9 keys; coerce to non-empty trimmed strings,
 *  apply the length guardrail, and drop anything that fails.
 *  Also applies the DB_VARCHAR_CAP (95 chars) unless --no-db-cap is set,
 *  to satisfy the live VARCHAR(100) schema until widened to TEXT. */
function sanitizePayload(obj) {
  const out = {};
  for (const f of EDUCATIONAL_FIELDS) {
    let v = obj[f];
    if (v == null) continue;
    if (typeof v !== "string") v = JSON.stringify(v);
    v = v.replace(/\s+/g, " ").trim();
    if (!v) continue;
    if (v.length > MAX_FIELD_CHARS_CLI) v = v.slice(0, MAX_FIELD_CHARS_CLI - 1).trim() + "…";
    if (!NO_DB_CAP && v.length > DB_VARCHAR_CAP) {
      v = v.slice(0, DB_VARCHAR_CAP - 1).trim() + "…";
    }
    out[f] = v;
  }
  return out;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Call GLM-5.2 with a short retry on transient network/rate errors.
 *  Routes to DEVICE_SYSTEM_PROMPT when nzfSourceText === NOT_IN_NZF_MARKER. */
async function callGlm(medicationName, nzfSourceText, attempt = 0) {
  const isDevice = nzfSourceText === NOT_IN_NZF_MARKER;
  const activePrompt = isDevice ? DEVICE_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const userContent = isDevice
    ? `Item: ${medicationName}\n\nThis item was not found in the NZF. Classify it as a device or specialist formulation and return the simplified JSON.`
    : nzfSourceText
      ? `Medication: ${medicationName}\n\nAuthoritative NZF source text for this medication (use ONLY this, do not extrapolate beyond it, but still obey every length/tone/JSON constraint):\n"""\n${nzfSourceText}\n"""`
      : `Medication: ${medicationName}`;

  try {
    const completion = await neuralwatt.chat.completions.create({
      model: NEURALWATT_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      response_format: { type: "json_object" },
      chat_template_kwargs: { thinking: false },
      // System prompt MUST live inside `messages` — the OpenAI SDK has no
      // top-level `system` param, so `system: activePrompt` was silently
      // dropped and GLM never received the schema (root cause of the 0/9
      // keys observed across all 500 meds in the --limit 500 test).
      messages: [
        { role: "system", content: activePrompt },
        { role: "user", content: userContent },
      ],
    });

    const msg = completion.choices?.[0]?.message ?? {};
    const content = typeof msg.content === "string" ? msg.content : "";
    const reasoning = typeof msg.reasoning === "string" ? msg.reasoning : "";
    const out = content.trim()
      ? content
      : reasoning.trim()
        ? reasoning
        : "";
    if (!content.trim() && reasoning.trim()) {
      console.warn(
        `  [glm] content empty for "${medicationName}" — using reasoning trace (${reasoning.length} chars)`,
      );
    }
    return { content: out, usage: completion.usage };
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      const wait = 1000 * (attempt + 1) * 2;
      console.warn(
        `  [retry] GLM error for "${medicationName}" (${e.message}); retrying in ${wait}ms…`,
      );
      await sleep(wait);
      return callGlm(medicationName, nzfSourceText, attempt + 1);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Per-medication worker
// ---------------------------------------------------------------------------
async function enrichMedication(row, stats) {
  const name = row.medication_name || `id:${row.id}`;
  if (!neuralwatt) {
    stats.skippedNoKey++;
    return;
  }
  // --re-scrape-name "<sub>": force re-scrape of rows whose name contains the
  // substring, ignoring cached raw_scraped_context so the new (possibly
  // multi-monograph) context replaces the old single-monograph text.
  const reScrapeNameMatch =
    RE_SCRAPE_NAME && name.toLowerCase().includes(RE_SCRAPE_NAME.toLowerCase());
  try {
    let nzfText = null;
    const cached = row.raw_scraped_context ? String(row.raw_scraped_context).trim() : "";
    // --re-scrape-all-cached: re-scrape any row that has cached context. We then
    // skip the GLM call unless the new scrape found multi-monograph content
    // (detected via "=== NZF MONOGRAPH 2/") or the text changed substantially —
    // this saves API tokens on the many drugs with only one monograph.
    const reScrapeAllCachedMatch = RE_SCRAPE_ALL_CACHED && cached && cached !== NOT_IN_NZF_MARKER;
    if (cached && cached !== NOT_IN_NZF_MARKER && !reScrapeNameMatch && !reScrapeAllCachedMatch) {
      nzfText = cached;
    } else if (cached === NOT_IN_NZF_MARKER && !RE_SCRAPE && !reScrapeNameMatch) {
      nzfText = NOT_IN_NZF_MARKER;
    } else if (!NO_SCRAPE) {
      const scraped = await scrapeNzfForMedication(name);
      if (scraped) {
        if (!DRY_RUN) {
          await persistScrapedContext(row.id, scraped);
        }
        if (reScrapeAllCachedMatch) {
          stats.scraped++;
          const isMultiMono = scraped.includes("=== NZF MONOGRAPH 2/");
          const changedSubstantially =
            Math.abs(scraped.length - cached.length) > Math.max(200, cached.length * 0.1);
          if (isMultiMono) {
            stats.multiMonographFound = (stats.multiMonographFound || 0) + 1;
            console.log(`  [multi-mono] "${name}" now has 2+ monographs (re-enriching)`);
            nzfText = scraped;
          } else if (changedSubstantially) {
            stats.contextChanged = (stats.contextChanged || 0) + 1;
            nzfText = scraped;
          } else {
            stats.skippedUnchanged = (stats.skippedUnchanged || 0) + 1;
            return;
          }
        } else {
          if ((RE_SCRAPE || reScrapeNameMatch) && cached === NOT_IN_NZF_MARKER) {
            stats.reScrapeFound++;
          }
          nzfText = scraped;
          stats.scraped++;
        }
      } else {
        nzfText = NOT_IN_NZF_MARKER;
        stats.scrapeMissed++;
        if (!DRY_RUN) {
          await persistScrapedContext(row.id, NOT_IN_NZF_MARKER);
        }
      }
    }
    if (!nzfText && NZF_MAP) {
      nzfText = NZF_MAP.get(String(name).toLowerCase()) || null;
    }

    const result = await callGlm(name, nzfText);
    stats.calls++;
    if (result.usage) {
      stats.promptTokens += result.usage.prompt_tokens || 0;
      stats.completionTokens += result.usage.completion_tokens || 0;
    }
    const parsed = parseJsonResponse(result.content);
    const payload = sanitizePayload(parsed);

    const filled = Object.keys(payload).length;
    if (filled === 0) {
      stats.empty++;
      console.warn(`  [empty] No usable keys for "${name}" (id ${row.id})`);
      return;
    }

    if (DRY_RUN) {
      stats.succeeded++;
      console.log(
        `  [dry-run] "${name}" -> ${filled}/9 keys parsed (would update id ${row.id})`,
      );
      return;
    }

    const { error } = await supabase
      .from("total_medications")
      .update(payload)
      .eq("id", row.id);

    if (error) throw new Error("supabase update: " + error.message);
    stats.succeeded++;
  } catch (e) {
    stats.failed++;
    console.error(`  [fail] "${name}" (id ${row.id}): ${e.message}`);
  }
}

async function persistScrapedContext(id, text) {
  try {
    const { error } = await supabase
      .from("total_medications")
      .update({ raw_scraped_context: text })
      .eq("id", id);
    if (error) console.warn(`  [scrape-cache] failed to persist text for id ${id}: ${error.message}`);
  } catch (e) {
    console.warn(`  [scrape-cache] error persisting text for id ${id}: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Read phase: fetch rows needing enrichment, paginated.
//   - Default: rows with at least one blank educational field.
//   - --re-scrape: rows where raw_scraped_context = NOT_IN_NZF (re-scrape them
//     with the fixed fuzzy matcher). Also clears those educational fields so
//     they get re-enriched with real clinical content.
// ---------------------------------------------------------------------------
async function fetchRowsNeedingEnrichment() {
  const rows = [];
  let from = 0;

  if (RE_SCRAPE_ALL_CACHED) {
    // Target ALL rows that have cached (non-NOT_IN_NZF) context. Re-scrapes
    // each one and smartly skips GLM unless multi-monograph content was found
    // or the text changed substantially. This is the broad fix for finding
    // all dual-use drugs across the entire DB.
    console.log("[read] --re-scrape-all-cached: targeting all rows with cached context…");
    while (true) {
      const { data, error } = await supabase
        .from("total_medications")
        .select(SELECT_COLUMNS)
        .not("raw_scraped_context", "is", null)
        .neq("raw_scraped_context", NOT_IN_NZF_MARKER)
        .order("medication_name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error("supabase select: " + error.message);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  }

  if (RE_SCRAPE_NAME) {
    // Target rows whose name contains the given substring — lets you re-scrape
    // specific dual-use drugs (e.g. --re-scrape-name "methotrexate") whose
    // cached raw_scraped_context only captured one of multiple monographs.
    console.log(`[read] --re-scrape-name: targeting rows matching "${RE_SCRAPE_NAME}"…`);
    while (true) {
      const { data, error } = await supabase
        .from("total_medications")
        .select(SELECT_COLUMNS)
        .ilike("medication_name", `%${RE_SCRAPE_NAME}%`)
        .order("medication_name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error("supabase select: " + error.message);
      if (!data || data.length === 0) break;
      // No blank-field filter — the whole point is to re-enrich fully-populated
      // rows whose old single-monograph context produced one-sided content.
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  }

  if (RE_SCRAPE) {
    // Target rows previously cached as NOT_IN_NZF — these may be real drugs
    // that the old exact-match scraper missed (e.g. Enalapril, Diltiazem).
    console.log("[read] --re-scrape: targeting rows cached as NOT_IN_NZF…");
    const eqFilter = `raw_scraped_context.eq.${NOT_IN_NZF_MARKER}`;
    while (true) {
      const { data, error } = await supabase
        .from("total_medications")
        .select(SELECT_COLUMNS)
        .eq("raw_scraped_context", NOT_IN_NZF_MARKER)
        .order("medication_name", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error("supabase select: " + error.message);
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  }

  // Default: rows with at least one blank educational field.
  const orFilter = EDUCATIONAL_FIELDS.map((f) => `${f}.is.null`).join(",");
  while (true) {
    const { data, error } = await supabase
      .from("total_medications")
      .select(SELECT_COLUMNS)
      .or(orFilter)
      .order("medication_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("supabase select: " + error.message);
    if (!data || data.length === 0) break;
    for (const r of data) if (rowNeedsEnrichment(r)) rows.push(r);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  console.log("=".repeat(70));
  console.log("build-educational-db.js — NeuralWatt GLM-5.2 enrichment");
  console.log("=".repeat(70));
  console.log("Supabase      : " + (SUPABASE_URL || "(not set)"));
  console.log("NeuralWatt URL: " + NEURALWATT_BASE_URL);
  console.log("Model         : " + NEURALWATT_MODEL);
  console.log("Concurrency   : " + CONCURRENCY + " (GLM p-limit pool)");
  console.log("Scrape pool   : " + SCRAPE_CONCURRENCY + " (NZF scraper p-limit pool)");
  console.log("Scraping      : " + (NO_SCRAPE ? "DISABLED (--no-scrape)" : "live nzf.org.nz scrape"));
  console.log("NZF source    : " + (NZF_MAP ? "local file loaded (fallback)" : "none — scraper only"));
  console.log("Mode          : " + (DRY_RUN ? "DRY RUN (no writes)" : "LIVE"));
  console.log("DB cap        : " + (NO_DB_CAP ? "DISABLED (--no-db-cap)" : `${DB_VARCHAR_CAP} chars`));
  console.log("Re-scrape     : " + (RE_SCRAPE ? "ENABLED — re-scraping NOT_IN_NZF rows with fixed fuzzy matcher" : "no"));
  console.log("Re-scrape name: " + (RE_SCRAPE_NAME ? `"${RE_SCRAPE_NAME}" — force re-scrape of matching rows (multi-monograph fix)` : "no"));
  console.log("Re-scrape all : " + (RE_SCRAPE_ALL_CACHED ? "ENABLED — re-scraping all cached rows; only re-enriching multi-monograph/changed" : "no"));
  console.log("Limit         : " + (LIMIT ? String(LIMIT) : "no cap"));
  console.log("-".repeat(70));

  if (!supabase) {
    console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }
  if (!NEURALWATT_API_KEY) {
    console.error(
      "ERROR: NEURALWATT_API_KEY is empty. Add your real NeuralWatt key to .env.local.\n" +
        "       (Without it every GLM-5.2 call will 401/404 and be counted as Failed.)",
    );
    process.exit(1);
  }

  console.log("[read] Fetching medications with blank educational fields…");
  const rows = await fetchRowsNeedingEnrichment();
  console.log(`[read] ${rows.length} medication(s) need enrichment.`);

  const work = LIMIT ? rows.slice(0, LIMIT) : rows;
  if (work.length === 0) {
    console.log("\nNothing to do — every medication is fully populated. 🎉");
    return;
  }

  const limit = pLimit(CONCURRENCY);
  const stats = {
    succeeded: 0,
    failed: 0,
    empty: 0,
    skippedNoKey: 0,
    scraped: 0,
    scrapeMissed: 0,
    reScrapeFound: 0,
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
  };
  let done = 0;

  await Promise.all(
    work.map((row) =>
      limit(async () => {
        await enrichMedication(row, stats);
        done++;
        if (done % 10 === 0 || done === work.length) {
          process.stdout.write(`\r[run] ${done}/${work.length} processed` + "        ");
        }
      }),
    ),
  );
  console.log("");

  const secs = ((Date.now() - t0) / 1000).toFixed(2);
  console.log("\n" + "=".repeat(70));
  console.log("DONE");
  console.log("=".repeat(70));
  console.log("Processed : " + work.length);
  console.log("Succeeded : " + stats.succeeded + (DRY_RUN ? " (dry-run, no writes)" : ""));
  console.log("Empty JSON: " + stats.empty);
  console.log("Failed    : " + stats.failed);
  if (RE_SCRAPE || RE_SCRAPE_NAME) {
    console.log("Re-scraped: " + stats.scraped + " now found (" + stats.scrapeMissed + " still missing → device prompt)");
    console.log("Upgraded  : " + stats.reScrapeFound + " rows upgraded from device disclaimer to real clinical content");
  } else if (RE_SCRAPE_ALL_CACHED) {
    console.log("Re-scraped   : " + stats.scraped + " rows re-scraped");
    console.log("Multi-mono   : " + (stats.multiMonographFound || 0) + " rows now have 2+ monographs (re-enriched)");
    console.log("Context diff : " + (stats.contextChanged || 0) + " rows with changed text (re-enriched)");
    console.log("Skipped      : " + (stats.skippedUnchanged || 0) + " unchanged single-monograph rows (GLM skipped, tokens saved)");
  } else {
    console.log("Scraped   : " + stats.scraped + " new (" + stats.scrapeMissed + " missed → device prompt)");
  }
  console.log("GLM calls : " + stats.calls);
  console.log("Tokens    : " + stats.promptTokens + " prompt / " + stats.completionTokens + " completion");
  console.log("Elapsed   : " + secs + "s");

  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});