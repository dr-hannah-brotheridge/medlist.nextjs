'use strict';

// Step 0a.4: Fetch the actual monograph page (/nzf_2439 paracetamol) and
// inspect its section structure with cheerio-like regex parsing.
const fs = require('fs');
const COOKIE = '_formularyLicence=Accepted';
const UA = 'MedListEducationalBot/1.0';
const MONO_URL = 'https://nzf.org.nz/nzf_2439';

(async () => {
  console.log('fetching', MONO_URL);
  const res = await fetch(MONO_URL, {
    headers: { Cookie: COOKIE, 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  const html = await res.text();
  console.log('status:', res.status, 'redirected:', res.redirected, 'finalUrl:', res.url);
  console.log('html length:', html.length);
  fs.writeFileSync('scripts/probe-nzf-mono.html', html);

  const lower = html.toLowerCase();
  console.log('\nsection keyword counts:');
  ['drug action', 'indications', 'dose', 'dosing', 'administration', 'cautions', 'contra-indications', 'contraindications', 'warnings', 'precautions', 'side effects', 'adverse effects', 'adverse', 'interactions', 'overdose', 'monitoring', 'pregnancy', 'breast feeding', 'breastfeeding', 'patient advice', 'hepatic impairment', 'renal impairment', 'preparation'].forEach((k) => {
    let n = 0, i = 0;
    while ((i = lower.indexOf(k, i)) !== -1) { n++; i += k.length; }
    console.log(`  ${k.padEnd(22)} ${n}`);
  });

  console.log('\nanchors with id (potential section targets):');
  const anchorRe = /<[^>]+id="([^"]+)"[^>]*>/g;
  let m, count = 0;
  while ((m = anchorRe.exec(html)) !== null && count < 40) {
    if (m[1] && m[1].length > 2 && !/^(tree|search|top|logo|main|content|nav|footer|header|alternate|section-filter|article-type)/i.test(m[1])) {
      console.log('  id="' + m[1] + '"');
      count++;
    }
  }

  console.log('\nheadings:');
  [/h1/gi, /h2/gi, /h3/gi, /h4/gi].forEach((t) => {
    const headingRe = new RegExp('<' + t.source + '[^>]*>([^<]{1,100})', 'gi');
    const headings = [];
    while ((m = headingRe.exec(html)) !== null) headings.push(m[1].trim());
    console.log(`  ${t.source.toUpperCase()}: ${headings.length} headings`);
    headings.slice(0, 15).forEach((h) => console.log('    -', h));
  });

  console.log('\ndiv with both class and id containing section-ish words:');
  const secRe = /<div[^>]*(class|id)="[^"]*(section|monograph|content|body|main)[^"]*"[^>]*>/gi;
  const secs = [];
  while ((m = secRe.exec(html)) !== null) secs.push(m[0].slice(0, 200));
  console.log('  matches:', secs.length);
  secs.slice(0, 10).forEach((s) => console.log('   ', s));

  console.log('\nDONE — saved to scripts/probe-nzf-mono.html for manual inspection');
})();