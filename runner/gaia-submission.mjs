// GAIA submission file (gaia-benchmark/leaderboard): one JSON line per test question, {task_id, model_answer, reasoning_trace}.
// Usage: node gaia-submission.mjs <out-dir>  -> <out-dir>/gaia-submission.jsonl; refuses if questions are missing (the server requires all 301).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as gaia from './src/sets/gaia.mjs';

const OUT = process.argv[2];
const rows = new Map();
for (const l of readFileSync(join(OUT, 'results.jsonl'), 'utf8').split('\n')) if (l) { const r = JSON.parse(l); rows.set(r.key, r); }
const test = gaia.load().filter((it) => it.split === 'test');
const lines = [], missing = [];
for (const it of test) {
  const r = rows.get(`nex|gaia|skill|${it.id}`);
  if (!r || r.status !== 'ok') { missing.push(it.id); continue; }
  const safe = r.key.replace(/[|.:]/g, '_');
  const ans = join(OUT, 'logs', safe + '.answer.md');
  const trace = existsSync(ans) ? readFileSync(ans, 'utf8').slice(0, 4000) : '';
  lines.push(JSON.stringify({ task_id: it.id, model_answer: r.answer ?? '', reasoning_trace: trace }));
}
if (missing.length) { console.log(`incomplete: missing ${missing.length}/${test.length}`); process.exit(1); }
writeFileSync(join(OUT, 'gaia-submission.jsonl'), lines.join('\n') + '\n');
console.log(`wrote ${lines.length} lines to gaia-submission.jsonl`);
