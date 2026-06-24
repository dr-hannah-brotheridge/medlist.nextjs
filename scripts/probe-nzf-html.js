'use strict';

// Step 0a: Probe NZF HTML structure.
// Decides cheerio (server-rendered) vs puppeteer (JS-rendered).
// Identifies monograph URL pattern + section selectors.
// Usage:  node scripts/probe-nzf-html.js [query]

const query = process.argv[2] || 'paracetamol';

// Minimal .env.local loader (not strictly needed here but keeps convention)
const fs = require('fs');
try {
  const txt = fs.readFileSync('.env.local', 'utf8');
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) { /* no .env.local — fine */ }

const UA = 'ScriptPalNzEducationalBot/1.0 (+mailto:support@scriptpal.nz; educational purposes; respectful scraping; max 1 req/sec)';

function redirHeaders(res) {
  return {
    status: res.status,
    finalUrl: res.url,
    redirected: res.redirected,
    contentType: res.headers.get('content-type'),
    server: res.headers.get('server'),
    contentLength: res.headers.get('content-length'),
  };
}

function countOccurrences(hay, needle) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

function parseSetCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return cookies.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function acceptLicenceGate() {
  console.log('\n' + '='.repeat(78));
  console.log('LICENCE GATE: POST /home/licence (btnAcceptTermsAndConditions=Accept)');
  console.log('-'.repeat(78));
  const t0 = Date.now();
  try {
    const res = await fetch('https://nzf.org.nz/home/licence', {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml',
      },
      body: 'btnAcceptTermsAndConditions=Accept',
      redirect: 'manual',
    });
    const ms = Date.now() - t0;
    console.log('elapsed:', ms, 'ms');
    console.log('status:', res.status);
    console.log('location:', res.headers.get('location'));
    const setCookie = res.headers.get('set-cookie');
    console.log('set-cookie raw:', setCookie ? setCookie.slice(0, 200) : '(none)');
    const cookie = parseSetCookie(setCookie);
    console.log('parsed cookie for forwarding:', cookie || '(none)');
    return cookie;
  } catch (e) {
    console.log('ERROR posting licence:', e.message);
    return '';
  }
}

async function probeSearch(sessionCookie) {
  const url = `https://nzf.org.nz/search?q=${encodeURIComponent(query)}`;
  console.log('\n' + '='.repeat(78));
  console.log('SEARCH PAGE PROBE:', url);
  console.log('-'.repeat(78));
  const t0 = Date.now();
  try {
    const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' };
    if (sessionCookie) headers['Cookie'] = sessionCookie;
    const res = await fetch(url, { headers, redirect: 'follow' });
    const html = await res.text();
    const ms = Date.now() - t0;
    console.log('elapsed:', ms, 'ms');
    console.log('response:', JSON.stringify(redirHeaders(res), null, 2));
    console.log('html length:', html.length);
    const lower = html.toLowerCase();
    console.log('\nkeyword counts in raw HTML:');
    ['paracetamol', 'indications', 'dose', 'cautions', 'side effects', 'warnings', 'contraindications', 'monograph', '/nzf/', 'href='].forEach((k) => {
      console.log(`  ${k.padEnd(20)} ${countOccurrences(lower, k.toLowerCase())}`);
    });

    // Try to find first monograph link (regex since no cheerio yet)
    const monographPatterns = [
      /href="(\/nzf\/[^"#?]+)"/gi,
      /href="(\/document\/[^"#?]+)"/gi,
      /href="(\/monograph\/[^"#?]+)"/gi,
      /href="(https:\/\/nzf\.org\.nz\/nzf\/[^"#?]+)"/gi,
      /href="(https:\/\/nzf\.org\.nz\/document\/[^"#?]+)"/gi,
      /href="(https:\/\/nzf\.org\.nz\/monograph\/[^"#?]+)"/gi,
    ];
    const found = {};
    monographPatterns.forEach((re) => {
      const matches = [];
      let m;
      while ((m = re.exec(html)) !== null) matches.push(m[1]);
      if (matches.length) found[re.source] = matches.slice(0, 5);
    });
    console.log('\nmonograph link candidates:');
    if (Object.keys(found).length === 0) console.log('  NONE FOUND in search results');
    else Object.entries(found).forEach(([re, links]) => {
      console.log(`  pattern: ${re}`);
      links.forEach((l) => console.log(`    - ${l}`));
    });

    const out = 'scripts/probe-nzf-search.html';
    fs.writeFileSync(out, html);
    console.log('\nraw search HTML saved to:', out);

    const allLinks = Object.values(found).flat();
    return allLinks.length ? allLinks[0] : null;
  } catch (e) {
    console.log('ERROR:', e.message);
    return null;
  }
}

function absolutize(maybeRel) {
  if (!maybeRel) return null;
  if (maybeRel.startsWith('http')) return maybeRel;
  if (maybeRel.startsWith('//')) return 'https:' + maybeRel;
  if (maybeRel.startsWith('/')) return 'https://nzf.org.nz' + maybeRel;
  return 'https://nzf.org.nz/' + maybeRel;
}

async function probeMonograph(monoUrl, sessionCookie) {
  if (!monoUrl) {
    console.log('\n[monograph] No monograph URL found — skipping probe');
    return;
  }
  const url = absolutize(monoUrl);
  console.log('\n' + '='.repeat(78));
  console.log('MONOGRAPH PAGE PROBE:', url);
  console.log('-'.repeat(78));
  const t0 = Date.now();
  try {
    const headers = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' };
    if (sessionCookie) headers['Cookie'] = sessionCookie;
    const res = await fetch(url, { headers, redirect: 'follow' });
    const html = await res.text();
    const ms = Date.now() - t0;
    console.log('elapsed:', ms, 'ms');
    console.log('response:', JSON.stringify(redirHeaders(res), null, 2));
    console.log('html length:', html.length);
    const lower = html.toLowerCase();
    console.log('\nclinical section keyword counts:');
    ['indications', 'dose', 'dosage', 'administration', 'cautions', 'contraindications', 'warnings', 'precautions', 'side effects', 'adverse', 'interactions', 'overdose', 'monitoring', 'pregnancy', 'breast feeding'].forEach((k) => {
      console.log(`  ${k.padEnd(20)} ${countOccurrences(lower, k.toLowerCase())}`);
    });

    console.log('\nHTML structure hints (first 3 matches each):');
    const structRes = [
      /<h1[^>]*>([^<]{0,80})/gi,
      /<h2[^>]*>([^<]{0,80})/gi,
      /<h3[^>]*>([^<]{0,80})/gi,
      /class="[^"]*(?:section|heading|tab|panel|accordion)[^"]*"/gi,
    ];
    structRes.forEach((re) => {
      const matches = [];
      let m;
      while ((m = re.exec(html)) !== null) matches.push(m[1] || m[0]);
      console.log(`  ${re.source.slice(0,60)}: ${matches.length} hits; first 3: ${JSON.stringify(matches.slice(0,3))}`);
    });

    const out = 'scripts/probe-nzf-monograph.html';
    fs.writeFileSync(out, html);
    console.log('\nraw monograph HTML saved to:', out);
    console.log('\n>>> INSPECT that file for: (1) is section text present in raw HTML? (2) what selectors wrap each section?');
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

(async () => {
  console.log('probe query:', query);
  const cookie = await acceptLicenceGate();
  const monoUrl = await probeSearch(cookie);
  await probeMonograph(monoUrl, cookie);
  console.log('\n' + '='.repeat(78));
  console.log('STEP 0a DONE — inspect the two saved .html files to decide cheerio vs puppeteer');
})();
