'use strict';

// Step 0a.3: Probe the discovered NZF endpoints to find monograph URLs.
const fs = require('fs');
const COOKIE = '_formularyLicence=Accepted';
const UA = 'MedListEducationalBot/1.0';

async function get(url, asJson = false) {
  console.log('\n' + '='.repeat(78));
  console.log('GET', url);
  console.log('-'.repeat(78));
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Cookie: COOKIE, 'User-Agent': UA, 'Accept': asJson ? 'application/json' : 'text/html' },
      redirect: 'follow',
    });
    const txt = await res.text();
    const ms = Date.now() - t0;
    console.log('elapsed:', ms, 'ms');
    console.log('status:', res.status, 'finalUrl:', res.url, 'redirected:', res.redirected);
    console.log('content-type:', res.headers.get('content-type'));
    console.log('length:', txt.length);
    console.log('first 800 chars:\n', txt.slice(0, 800));
    return txt;
  } catch (e) {
    console.log('ERROR:', e.message);
    return '';
  }
}

(async () => {
  const ac = await get('https://nzf.org.nz/Search/AutoComplete?q=paracetamol');
  fs.writeFileSync('scripts/probe-nzf-ac.txt', ac);

  const r = await get('https://nzf.org.nz/Search/Results?term=paracetamol');
  fs.writeFileSync('scripts/probe-nzf-results.html', r);

  await get('https://nzf.org.nz/Search/AutoComplete?q=paracetamol&format=json', true);

  console.log('\n' + '='.repeat(78));
  console.log('DONE — inspect saved files for monograph link patterns');
})();