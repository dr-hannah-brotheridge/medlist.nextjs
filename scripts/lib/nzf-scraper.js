'use strict';

// NZF monograph scraper.
// Given a generic drug name, searches nzf.org.nz, resolves ALL matching
// monograph URLs (some drugs have 2+ monographs — one per therapeutic use,
// e.g. Methotrexate is both an antineoplastic [nzf_71530] and an autoimmune
// agent [nzf_4548]), fetches each monograph page, and extracts labelled
// clinical section text. The per-monograph texts are concatenated with
// context headers so GLM-5.2 can synthesise across every use.
//
// API:
//   const { scrapeNzfForMedication } = require('./scripts/lib/nzf-scraper');
//   const text = await scrapeNzfForMedication('methotrexate');
//   // text === "=== NZF MONOGRAPH 1/2: methotrexate (nzf_71530 — 8 Malignant...) ===\nDrug action: ...\n\n=== NZF MONOGRAPH 2/2: ... ===\n..."
//   //     or null if no monograph found / network error (never throws)
//
// CLI mode:
//   node scripts/lib/nzf-scraper.js "methotrexate"

const cheerio = require('cheerio');

const NZF_BASE = 'https://nzf.org.nz';
const UA = 'ScriptPalNzEducationalBot/1.0 (+mailto:support@scriptpal.nz; educational purposes; respectful scraping; max 1 req/sec)';
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const SKIP_SECTIONS = new Set(['Preparation Group', 'Community Funding rules', 'Notes/Guidelines']);

let _licenceCookie = null;

async function ensureLicence() {
  if (_licenceCookie) return _licenceCookie;
  const res = await fetch(`${NZF_BASE}/home/licence`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
    },
    body: 'btnAcceptTermsAndConditions=Accept',
    redirect: 'manual',
  });
  const sc = res.headers.get('set-cookie');
  if (!sc) throw new Error('NZF licence gate did not return a Set-Cookie header');
  _licenceCookie = sc.split(';')[0].trim();
  return _licenceCookie;
}

async function fetchWithRetry(url, { json = false } = {}) {
  const cookie = await ensureLicence();
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          Cookie: cookie,
          'User-Agent': UA,
          Accept: json ? 'application/json' : 'text/html,application/xhtml+xml',
        },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      const name = e && e.name ? e.name : 'Error';
      console.error(`[nzf-scraper] fetch attempt ${attempt}/${MAX_RETRIES} failed (${name}: ${e.message}) for ${url}`);
      if (attempt < MAX_RETRIES) {
        const backoff = 500 * attempt;
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}

/** Normalize a drug name for fuzzy matching:
 *  - lowercase, trim
 *  - strip "(as ...)" salt/form suffixes (e.g., "Enalapril (as enalapril maleate)" -> "enalapril")
 *  - strip "(ECP)" / "(depot)" qualifiers
 *  - collapse whitespace */
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s*\(as[^)]*\)/g, '')   // remove "(as enalapril maleate)"
    .replace(/\s*\(ecp\)/g, '')        // remove "(ECP)"
    .replace(/\s*\(depot\)/g, '')      // remove "(depot)"
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip query string + fragment from a URL path so duplicate results that differ
 *  only by ?searchterm=... collapse to the same monograph. */
function canonicalUrl(url) {
  try {
    const u = new URL(url, NZF_BASE);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split('#')[0].split('?')[0];
  }
}

/** Extract the nzf_XXXX identifier from a monograph URL (e.g. .../nzf_4548 -> nzf_4548). */
function extractNzfIdFromUrl(url) {
  const m = String(url).match(/\/(nzf_\d+)(?:[/?#]|$)/i);
  return m ? m[1] : null;
}

/** Extract breadcrumbs text (chapter context) from a search result element.
 *  Returns something like "8 Malignant disease and immunosuppression > 8.1 ...". */
function extractBreadcrumbs($el, $) {
  const $bc = $el.find('.article-breadcrumbs').first();
  if (!$bc.length) return '';
  const crumbs = [];
  $bc.find('a').each((_, a) => {
    const t = $(a).text().trim();
    if (t && t.toLowerCase() !== 'home') crumbs.push(t);
  });
  return crumbs.join(' > ');
}

/** Find ALL matching monograph URLs on a search results page.
 *  Returns an array of { url, title, breadcrumbs } in document order, deduped by canonical URL.
 *
 *  A "match" is any monograph result whose title exactly equals the search term
 *  (priority 1) OR fuzzily contains it (priority 2). Exact matches are returned
 *  first, then fuzzy matches, so callers see the most relevant monographs first.
 *  Crucially, we do NOT stop at the first match — drugs like Methotrexate have
 *  2+ monographs (one per therapeutic use) and we need every one of them. */
function findMonographUrls(resultsHtml, searchTerm) {
  const $ = cheerio.load(resultsHtml);
  const target = normalizeName(searchTerm);
  const exact = [];   // priority 1
  const fuzzy = [];   // priority 2
  const seen = new Set();

  $('div.search-result').each((_, el) => {
    const $el = $(el);
    const isMonograph = $el.find('.monograph-text').length > 0;
    if (!isMonograph) return;
    const $heading = $el.find('.search-result-heading a').first();
    const title = $heading.text().trim().toLowerCase();
    const normTitle = normalizeName(title);
    let href = $heading.attr('href') || '';
    if (!href) return;
    const fullUrl = href.startsWith('http') ? href : NZF_BASE + (href.startsWith('/') ? href : '/' + href);
    const canon = canonicalUrl(fullUrl);
    if (seen.has(canon)) return; // dedupe (same monograph appearing 2x with different matched sections)
    const breadcrumbs = extractBreadcrumbs($el, $);

    if (title === target || normTitle === target) {
      seen.add(canon);
      exact.push({ url: canon, title, breadcrumbs });
    } else if (normTitle.includes(target) || target.includes(normTitle)) {
      seen.add(canon);
      fuzzy.push({ url: canon, title, breadcrumbs });
    }
  });

  return [...exact, ...fuzzy];
}

function extractMonographSections(monoHtml) {
  const $ = cheerio.load(monoHtml);
  const $mono = $('.monograph').first();
  if (!$mono.length) return null;

  const sections = [];
  let current = null;
  let buffer = [];

  function walk(nodes) {
    nodes.each((_, node) => {
      if (node.type === 'text') {
        const t = $(node).text().trim();
        if (t) buffer.push(t);
      } else if (node.type === 'tag') {
        const $el = $(node);
        if ($el.is('.section-title')) {
          if (current && !SKIP_SECTIONS.has(current)) {
            const body = buffer.join(' ').replace(/\s+/g, ' ').trim();
            if (body) sections.push({ name: current, body });
          }
          current = $el.text().trim();
          buffer = [];
        } else {
          walk($el.contents());
        }
      }
    });
  }

  walk($mono.contents());

  if (current && !SKIP_SECTIONS.has(current)) {
    const body = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (body) sections.push({ name: current, body });
  }

  return sections;
}

function formatSectionsAsText(sections) {
  if (!sections || !sections.length) return null;
  const nonEmpty = sections.filter((s) => s.body && s.body.length > 0);
  if (!nonEmpty.length) return null;
  return nonEmpty.map((s) => `${s.name}: ${s.body}`).join('\n\n');
}

/** Build a context header for a monograph block so GLM-5.2 can tell multiple
 *  uses apart. e.g. "=== NZF MONOGRAPH 1/2: methotrexate (nzf_71530 — 8 Malignant disease and immunosuppression) ===" */
function formatMonographHeader(meta, index, total) {
  const nzfId = extractNzfIdFromUrl(meta.url) || meta.url;
  const ctx = meta.breadcrumbs ? ` — ${meta.breadcrumbs}` : '';
  const title = meta.title || nzfId;
  return `=== NZF MONOGRAPH ${index}/${total}: ${title} (${nzfId}${ctx}) ===`;
}

/** Scrape NZF for a medication. Returns concatenated section text from ALL
 *  matching monographs (so dual-use drugs get both sides of the story), or
 *  null if no monograph found / on error. Never throws. */
async function scrapeNzfForMedication(genericName) {
  try {
    const resultsUrl = `${NZF_BASE}/Search/Results?term=${encodeURIComponent(genericName)}`;
    const resultsHtml = await fetchWithRetry(resultsUrl);
    if (!resultsHtml) {
      console.error(`[nzf-scraper] no results page for "${genericName}"`);
      return null;
    }
    const matches = findMonographUrls(resultsHtml, genericName);
    if (!matches.length) {
      console.error(`[nzf-scraper] no monograph link(s) for "${genericName}"`);
      return null;
    }

    const blocks = [];
    let fetched = 0;
    for (let i = 0; i < matches.length; i++) {
      const meta = matches[i];
      const monoHtml = await fetchWithRetry(meta.url);
      if (!monoHtml) {
        console.error(`[nzf-scraper] monograph page empty for "${genericName}" (${meta.url})`);
        continue;
      }
      const sections = extractMonographSections(monoHtml);
      const text = formatSectionsAsText(sections);
      if (!text) {
        console.error(`[nzf-scraper] no sections extracted for "${genericName}" (${meta.url})`);
        continue;
      }
      const header = formatMonographHeader(meta, fetched + 1, matches.length);
      blocks.push(`${header}\n${text}`);
      fetched++;
    }

    if (!blocks.length) {
      console.error(`[nzf-scraper] no usable monograph text for "${genericName}"`);
      return null;
    }

    // If only one monograph, return its text WITHOUT the header (preserves
    // backwards compatibility with the original single-monograph format so
    // existing cached rows don't need re-processing unless the drug has 2+).
    if (blocks.length === 1) return blocks[0].split('\n').slice(1).join('\n');

    return blocks.join('\n\n');
  } catch (e) {
    console.error(`[nzf-scraper] error scraping "${genericName}": ${e.message}`);
    return null;
  }
}

module.exports = {
  scrapeNzfForMedication,
  ensureLicence,
  findMonographUrls,
  extractMonographSections,
  formatSectionsAsText,
  normalizeName,
  canonicalUrl,
  extractNzfIdFromUrl,
  extractBreadcrumbs,
  NZF_BASE,
  /** @deprecated use findMonographUrls (plural) — kept for backward compat;
   *  returns only the first match. */
  findMonographUrl: (html, term) => {
    const arr = findMonographUrls(html, term);
    return arr.length ? arr[0].url : null;
  },
};

if (require.main === module) {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: node scripts/lib/nzf-scraper.js "<generic-name>"');
    process.exit(1);
  }
  (async () => {
    console.log(`Scraping NZF for "${name}"...`);
    const t0 = Date.now();
    const text = await scrapeNzfForMedication(name);
    const ms = Date.now() - t0;
    console.log(`\nelapsed: ${ms}ms`);
    if (!text) {
      console.log('RESULT: null (no monograph found or extraction failed)');
      process.exit(0);
    }
    console.log(`text length: ${text.length} chars`);
    // Count how many monograph blocks were returned.
    const monoCount = (text.match(/=== NZF MONOGRAPH \d+\/\d+/g) || []).length;
    console.log(`monographs merged: ${monoCount || 1}`);
    console.log('\n--- first 3000 chars ---');
    console.log(text.slice(0, 3000));
    if (text.length > 3000) console.log(`\n...[truncated, ${text.length - 3000} more chars]`);
  })();
}