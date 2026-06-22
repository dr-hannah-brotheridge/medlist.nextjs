'use strict';

// NZF monograph scraper.
// Given a generic drug name, searches nzf.org.nz, resolves the monograph URL,
// fetches the monograph page, and extracts labelled clinical section text.
//
// API:
//   const { scrapeNzfForMedication } = require('./scripts/lib/nzf-scraper');
//   const text = await scrapeNzfForMedication('paracetamol');
//   // text === "Drug action: ...\n\nContra-indications: ...\n\nCautions: ..."
//   //     or null if no monograph found / network error (never throws)
//
// CLI mode:
//   node scripts/lib/nzf-scraper.js "paracetamol"

const cheerio = require('cheerio');

const NZF_BASE = 'https://nzf.org.nz';
const UA = 'MedListEducationalBot/1.0 (+mailto:support@medlist.nz; educational purposes; respectful scraping; max 1 req/sec)';
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

function findMonographUrl(resultsHtml, searchTerm) {
  const $ = cheerio.load(resultsHtml);
  const target = searchTerm.trim().toLowerCase();
  let monoUrl = null;
  $('div.search-result').each((_, el) => {
    if (monoUrl) return;
    const $el = $(el);
    const isMonograph = $el.find('.monograph-text').length > 0;
    if (!isMonograph) return;
    const $heading = $el.find('.search-result-heading a').first();
    const title = $heading.text().trim().toLowerCase();
    if (title === target) {
      let href = $heading.attr('href') || '';
      if (!href) return;
      monoUrl = href.startsWith('http') ? href : NZF_BASE + (href.startsWith('/') ? href : '/' + href);
    }
  });
  return monoUrl;
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

async function scrapeNzfForMedication(genericName) {
  try {
    const resultsUrl = `${NZF_BASE}/Search/Results?term=${encodeURIComponent(genericName)}`;
    const resultsHtml = await fetchWithRetry(resultsUrl);
    if (!resultsHtml) {
      console.error(`[nzf-scraper] no results page for "${genericName}"`);
      return null;
    }
    const monoUrl = findMonographUrl(resultsHtml, genericName);
    if (!monoUrl) {
      console.error(`[nzf-scraper] no monograph link for "${genericName}"`);
      return null;
    }
    const monoHtml = await fetchWithRetry(monoUrl);
    if (!monoHtml) {
      console.error(`[nzf-scraper] monograph page empty for "${genericName}" (${monoUrl})`);
      return null;
    }
    const sections = extractMonographSections(monoHtml);
    const text = formatSectionsAsText(sections);
    if (!text) {
      console.error(`[nzf-scraper] no sections extracted for "${genericName}" (${monoUrl})`);
      return null;
    }
    return text;
  } catch (e) {
    console.error(`[nzf-scraper] error scraping "${genericName}": ${e.message}`);
    return null;
  }
}

module.exports = {
  scrapeNzfForMedication,
  ensureLicence,
  findMonographUrl,
  extractMonographSections,
  formatSectionsAsText,
  NZF_BASE,
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
    console.log('\n--- first 2000 chars ---');
    console.log(text.slice(0, 2000));
    if (text.length > 2000) console.log(`\n...[truncated, ${text.length - 2000} more chars]`);
  })();
}