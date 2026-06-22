'use strict';

// Step 0a.2: Find NZF autocomplete API endpoint by grep'ing the minified JS.
const fs = require('fs');

const JS_URL = 'https://nzf.org.nz/js/formulary.min.js?v=r3sUdgNLDhXDwNorg3-2Zx13HEjEHcwz-J-haQI0_UA';
const COOKIE = '_formularyLicence=Accepted';

(async () => {
  console.log('fetching minified JS...');
  const res = await fetch(JS_URL, { headers: { Cookie: COOKIE } });
  const js = await res.text();
  console.log('js length:', js.length);
  fs.writeFileSync('scripts/probe-nzf-formulary.js.txt', js);

  // Find URL-like string literals containing path segments of interest
  const re = /["'`](\/[^"'`\s]{2,80})["'`]/g;
  const paths = new Set();
  let m;
  while ((m = re.exec(js)) !== null) {
    const p = m[1];
    if (/(search|autocomplete|monograph|article|api)/i.test(p)) paths.add(p);
  }
  console.log('\nURL-ish path literals of interest:', paths.size);
  [...paths].sort().forEach((p) => console.log(' ', p));

  // Show ~80 chars of context around each 'autocomplete' mention (case-insensitive)
  const lower = js.toLowerCase();
  console.log('\n--- autocomplete context windows ---');
  let idx = 0, count = 0;
  while ((idx = lower.indexOf('autocomplete', idx)) !== -1 && count < 8) {
    console.log('...[' + js.slice(Math.max(0, idx - 80), idx + 120) + ']...');
    idx += 12;
    count++;
  }
})();