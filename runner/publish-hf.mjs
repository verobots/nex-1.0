// Writes .eval_results/<set>.yaml (official Hugging Face leaderboards) for Nex 1.0, skill arm, ONLY for sets run completely without errors.
// Usage: node publish-hf.mjs <hf-repo-dir> <out-dir> [<out-dir> ...]  -> prints what was written and what is incomplete.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SETS, ROUTES } from './config.mjs';
import * as gpqa from './src/sets/gpqa.mjs';
import * as hle from './src/sets/hle.mjs';
import { make as matharena } from './src/sets/matharena.mjs';

const MODS = { 'gpqa-diamond': gpqa, hle, 'aime-2026': matharena('aime-2026', true), 'hmmt-feb-2026': matharena('hmmt-feb-2026', false) };
const [repo, ...outs] = process.argv.slice(2);
const rows = new Map();
for (const o of outs) {
  const f = join(o, 'results.jsonl');
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split('\n')) if (l) { const r = JSON.parse(l); rows.set(r.key, r); }
}
mkdirSync(join(repo, '.eval_results'), { recursive: true });
for (const [set, mod] of Object.entries(MODS)) {
  const cfg = SETS[set], route = ROUTES[cfg.route];
  const ids = mod.load().map((it) => it.id);
  const got = ids.map((id) => rows.get(`nex|${set}|skill|${id}`)).filter((r) => r && r.status === 'ok');
  if (got.length !== ids.length) { console.log(`${set}: incomplete ${got.length}/${ids.length}`); continue; }
  const value = +(100 * got.reduce((s, r) => s + r.score, 0) / got.length).toFixed(2);
  const date = got.map((r) => r.at).sort().pop().slice(0, 10);
  const yaml = [
    '- dataset:',
    `    id: ${cfg.hf.id}`,
    `    task_id: ${cfg.hf.task}`,
    `  value: ${value}`,
    `  date: "${date}"`,
    '  source:',
    `    url: https://github.com/verobots/nex-1.0/tree/main/results/${set}`,
    '    name: Nex 1.0 per-item results and harness',
    '    user: verobots',
    `  notes: "Nex 1.0 router -> ${route.model} (reasoning effort ${route.effort}) via ${route.cli} CLI + per-benchmark skill; no web, no tools; single sample; all ${ids.length} items"`,
  ].join('\n') + '\n';
  writeFileSync(join(repo, '.eval_results', `${set}.yaml`), yaml);
  console.log(`${set}: ${value} (${ids.length} items) written`);
}
