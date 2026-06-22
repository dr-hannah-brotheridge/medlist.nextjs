'use strict';

// Step 0b: Resolve GLM-5.2 thinking-kill strategy.
// Tries multiple param combinations to disable the reasoning trace,
// and also fetches /v1/models to find a non-thinking fallback.
// Usage:  node scripts/probe-glm-thinking.js

// Minimal .env.local loader (no dotenv dependency, matches sibling script convention)
const fs = require('fs');
try {
  const txt = fs.readFileSync('.env.local', 'utf8');
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
} catch (e) {
  console.warn('[probe] No .env.local found or unreadable, relying on shell env');
}

const BASE = process.env.NEURALWATT_BASE_URL || 'https://api.neuralwatt.com/v1';
const KEY = process.env.NEURALWATT_API_KEY;
const MODEL = process.env.NEURALWATT_MODEL || 'glm-5.2';

if (!KEY) {
  console.error('NEURALWATT_API_KEY is not set in .env.local');
  process.exit(1);
}

const OpenAI = require('openai').default;
const client = new OpenAI({ baseURL: BASE, apiKey: KEY });

const PROMPT = 'Return ONLY this exact JSON object, nothing else: {"drug_class":"analgesic","why_it_is_prescribed":"pain","what_it_does_in_the_body":"blocks COX","what_organ_or_condition_it_protects":"nervous system","what_happens_if_you_stop_it":"pain returns","common_dose_range":"500-1000mg","side_effects":"nausea","what_symptoms_to_watch_for":"rash","when_to_seek_help":"difficulty breathing"}';

const VARIANTS = [
  {
    name: 'baseline (current settings)',
    params: { max_tokens: 4096, temperature: 0.2, response_format: { type: 'json_object' } },
  },
  {
    name: 'chat_template_kwargs.thinking=false',
    params: {
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { thinking: false },
    },
  },
  {
    name: 'enable_thinking=false (top-level)',
    params: {
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      enable_thinking: false,
    },
  },
  {
    name: 'extra_body wrapper (enable_thinking + chat_template_kwargs)',
    params: {
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      extra_body: {
        enable_thinking: false,
        chat_template_kwargs: { enable_thinking: false, thinking: false },
      },
    },
  },
  {
    name: 'thinking.type=disabled (OpenAI reasoning format)',
    params: {
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    },
  },
  {
    name: 'no response_format + chat_template_kwargs.thinking=false',
    params: {
      max_tokens: 4096,
      temperature: 0.2,
      chat_template_kwargs: { thinking: false },
    },
  },
  {
    name: 'no response_format + enable_thinking=false',
    params: {
      max_tokens: 4096,
      temperature: 0.2,
      enable_thinking: false,
    },
  },
];

async function tryVariant(name, params) {
  console.log('\n' + '='.repeat(78));
  console.log('VARIANT:', name);
  console.log('params:', JSON.stringify(params));
  console.log('-'.repeat(78));
  const t0 = Date.now();
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a clinical JSON generator. Return only valid JSON.' },
        { role: 'user', content: PROMPT },
      ],
      ...params,
    });
    const ms = Date.now() - t0;
    const choice = res.choices && res.choices[0];
    const msg = choice && choice.message ? choice.message : {};
    const content = msg.content || null;
    const reasoning = msg.reasoning || msg.reasoning_content || null;
    const finish = choice && choice.finish_reason ? choice.finish_reason : null;
    const usage = res.usage || {};
    console.log('elapsed:', ms, 'ms');
    console.log('finish_reason:', finish);
    console.log('content:', content ? (content.length > 200 ? content.slice(0, 200) + '...[truncated]' : content) : 'NULL');
    console.log('reasoning:', reasoning ? (typeof reasoning === 'string' && reasoning.length > 200 ? reasoning.slice(0, 200) + '...[truncated]' : reasoning) : 'null/absent');
    console.log('usage:', JSON.stringify(usage));
    const hasContent = !!content;
    const hasReasoning = !!reasoning;
    let verdict;
    if (hasContent && !hasReasoning) verdict = 'WIN — content only, no reasoning trace';
    else if (hasContent && hasReasoning) verdict = 'PARTIAL — content present but reasoning also emitted';
    else if (!hasContent && hasReasoning) verdict = 'FAIL — only reasoning, no content (thinking consumes token budget)';
    else verdict = 'FAIL — neither content nor reasoning';
    console.log('VERDICT:', verdict);
    return verdict;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log('elapsed:', ms, 'ms');
    console.log('ERROR:', e.message);
    if (e.status) console.log('status:', e.status);
    if (e.error) console.log('error body:', JSON.stringify(e.error).slice(0, 300));
    return 'ERROR';
  }
}

async function listModels() {
  console.log('\n' + '='.repeat(78));
  console.log('FETCHING /v1/models LIST');
  console.log('-'.repeat(78));
  try {
    const list = await client.models.list();
    const data = (list && list.data) || [];
    console.log('count:', data.length);
    data.forEach((m) => {
      const id = m.id || m.name || '(no id)';
      console.log(' -', id);
    });
    const candidates = data.filter((m) => {
      const id = (m.id || m.name || '').toLowerCase();
      return id.includes('glm') && !id.includes('thinking') && !id.includes('reason');
    });
    if (candidates.length) {
      console.log('\nPossible NON-THINKING GLM candidates:');
      candidates.forEach((m) => console.log(' *', m.id || m.name));
    }
  } catch (e) {
    console.log('ERROR listing models:', e.message);
  }
}

(async () => {
  console.log('base:', BASE);
  console.log('model:', MODEL);
  console.log('key present:', !!KEY);

  for (const v of VARIANTS) {
    await tryVariant(v.name, v.params);
  }

  await listModels();

  console.log('\n' + '='.repeat(78));
  console.log('DONE — review VERDICT lines above to pick the working strategy');
})();