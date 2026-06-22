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
 *   node scripts/build-educational-db.js [--dry-run] [--limit N] [--concurrency K] [--no-scrape]
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
// GLM-5.2 is a reasoning/thinking model — it emits a `reasoning` trace that
// consumes the token budget before producing `content`. A 1200-token cap
// caused `content:null` + `finish_reason:"length"`. 4096 gives the JSON
// output room. Overridable via env for experimentation.
const MAX_TOKENS = Number(process.env.NEURALWATT_MAX_TOKENS) || 4096;
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
// Rigid system prompt (embedded verbatim per task §4, + schema keys).
// Exact 3-constraint block is kept intact; the schema list is appended so the
// model returns the precise DB column keys.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = [
  "You are a highly precise Medical Translation Interface operating strictly within the guidelines of the New Zealand Formulary (NZF). Your task is to provide translation content for a mobile PWA patient application.",
  "",
  "You must strictly adhere to the following execution constraints:",
  "1. BREVITY CONSTRAINT: For each individual column key, the output material MUST NOT extend beyond a few sentences (maximum 2-3 brief sentences). It must be punchy, highly scannable, brief, and coherent. No lengthy blocks of text are permitted.",
  "2. FORMATTING: You must return your response as a raw, valid JSON object matching the 9 target column keys exactly as provided. Do not wrap the JSON in Markdown code blocks (such as ```json) or add introductory/concluding conversational text.",
  "3. TONE: Write at a clear 6th-grade reading level. Eliminate dense medical jargon (e.g., instead of \"dyspnea\", write \"shortness of breath\").",
  "",
  "When no authoritative NZF source text is supplied for a medication in the user message, you are instructed to act AS the authoritative New Zealand Formulary (NZF) resource baseline and generate the accurate medical parameters internally for that specific medication name, still obeying every constraint above.",
  "",
  "Return ONLY a JSON object with these exact 9 keys (and no others):",
  JSON.stringify(EDUCATIONAL_FIELDS, null, 2),
].join("\n");

// ---------------------------------------------------------------------------
// NZF local source file handling (task §3).
// Wired to load an optional NZF dump (CSV/JSON) keyed by medication name. When
// present, the raw clinical row text is fed into the LLM user prompt; when no
// file is found, the system prompt's fallback (GLM-as-NZF-baseline) is used.
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

/** Strip accidental ```json fences / surrounding prose and parse. */
function parseJsonResponse(text) {
  if (!text) throw new Error("empty response");
  let s = String(text).trim();
  // Strip Markdown code fences if the model disobeyed constraint #2.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Fallback: isolate the outermost { ... } block.
  if (s.charAt(0) !== "{") {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}

/** Validate + sanitize the 9 keys; coerce to non-empty trimmed strings,
 *  apply the length guardrail, and drop anything that fails. */
function sanitizePayload(obj) {
  const out = {};
  for (const f of EDUCATIONAL_FIELDS) {
    let v = obj[f];
    if (v == null) continue; // model omitted — leave DB column untouched.
    if (typeof v !== "string") v = JSON.stringify(v);
    v = v.replace(/\s+/g, " ").trim();
    if (!v) continue;
    if (v.length > MAX_FIELD_CHARS_CLI) v = v.slice(0, MAX_FIELD_CHARS_CLI - 1).trim() + "…";
    out[f] = v;
  }
  return out;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Call GLM-5.2 with a short retry on transient network/rate errors. */
async function callGlm(medicationName, nzfSourceText, attempt = 0) {
  const userContent = nzfSourceText
    ? `Medication: ${medicationName}\n\nAuthoritative NZF source text for this medication (use ONLY this, do not extrapolate beyond it, but still obey every length/tone/JSON constraint):\n"""\n${nzfSourceText}\n"""`
    : `Medication: ${medicationName}`;

  try {
    const completion = await neuralwatt.chat.completions.create({
      model: NEURALWATT_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.2,
      response_format: { type: "json_object" },
      // Zhipu GLM convention: disable the thinking/reasoning trace so the
      // token budget goes straight into the JSON `content`. Best-effort: if
      // the NeuralWatt server rejects the field, it's simply ignored.
      chat_template_kwargs: { thinking: false },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const msg = completion.choices?.[0]?.message ?? {};
    // GLM-5.2 may return the answer in `reasoning` when `content` is null
    // (thinking not disabled). Prefer `content`; fall back to `reasoning`
    // so we still get a payload instead of an empty failure.
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
  try {
    // Prefer previously-scraped text cached in the DB; else live-scrape (unless --no-scrape).
    // Also consult the local NZF source file as a secondary fallback.
    let nzfText = null;
    if (row.raw_scraped_context && String(row.raw_scraped_context).trim()) {
      nzfText = String(row.raw_scraped_context).trim();
    } else if (!NO_SCRAPE) {
      const scraped = await scrapeNzfForMedication(name);
      if (scraped) {
        nzfText = scraped;
        stats.scraped++;
        // Persist scraped text so re-runs don't re-scrape (unless dry-run).
        if (!DRY_RUN) {
          await persistScrapedContext(row.id, scraped);
        }
      } else {
        stats.scrapeMissed++;
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
// ---------------------------------------------------------------------------
async function fetchRowsNeedingEnrichment() {
  const rows = [];
  let from = 0;
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
    // Defensive JS-side filter (also catches empty-string "blanks").
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
  console.log("Scraped   : " + stats.scraped + " new (" + stats.scrapeMissed + " missed)");
  console.log("GLM calls : " + stats.calls);
  console.log("Tokens    : " + stats.promptTokens + " prompt / " + stats.completionTokens + " completion");
  console.log("Elapsed   : " + secs + "s");

  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});