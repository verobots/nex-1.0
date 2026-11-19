// OlaBench report: score per system x set x arm, with 95% confidence interval, tokens and time; plus the ARC submission file.
// Usage: node report.mjs <dosar-out>  -> report.json, report.md, arc-submission-<system>-<arm>.json

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as arc from './src/sets/arc.mjs';
import * as simpleqa from './src/sets/simpleqa.mjs';

const OUT = process.argv[2];
const rows = new Map();
for (const l of readFileSync(join(OUT, 'results.jsonl'), 'utf8').split('\n')) if (l) { const r = JSON.parse(l); rows.set(r.key, r); }
const all = [...rows.values()];

function stats(list) {
  const ok = list.filter((r) => r.status === 'ok');
  const n = ok.length, mean = n ? ok.reduce((s, r) => s + r.score, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(ok.reduce((s, r) => s + (r.score - mean) ** 2, 0) / (n - 1)) : 0;
  const half = n ? 1.96 * sd / Math.sqrt(n) : 0;
  const tok = (k) => Math.round(ok.reduce((s, r) => s + (r.usage?.[k] || 0), 0) / (n || 1));
  return {
    n, errors: list.length - n, score: +(100 * mean).toFixed(1), ci95: +(100 * half).toFixed(1),
    avgSec: Math.round(ok.reduce((s, r) => s + (r.sec || 0), 0) / (n || 1)),
    avgTokens: { input: tok('input') + tok('cached') + tok('cacheWrite'), output: tok('output'), reasoning: tok('reasoning') },
    model: ok[0]?.model, effort: ok[0]?.effort,
  };
}

const groups = {};
for (const r of all) (groups[`${r.system}|${r.set}|${r.split}|${r.arm}`] ||= []).push(r);
const table = Object.entries(groups).map(([g, list]) => {
  const [system, set, split, arm] = g.split('|');
  const s = { system, set, split, arm, ...stats(list) };
  if (set === 'simpleqa-verified') s.simpleqa = Object.fromEntries(Object.entries(simpleqa.summary(list.filter((r) => r.status === 'ok'))).map(([k, v]) => [k, +(100 * v).toFixed(1)]));
  return s;
}).sort((a, b) => (a.set + a.split + a.system + a.arm).localeCompare(b.set + b.split + b.system + b.arm));

// Paired difference between an arm and standard on the same items, so "+X from the skill" has its own interval.
function paired(system, set, split, arm) {
  const d = [];
  for (const r of all) {
    if (r.system !== system || r.set !== set || r.split !== split || r.arm !== arm || r.status !== 'ok') continue;
    const b = rows.get(`${system}|${set}|standard|${r.item}`);
    if (b?.status === 'ok') d.push(r.score - b.score);
  }
  const n = d.length, m = n ? d.reduce((s, x) => s + x, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0;
  return { n, delta: +(100 * m).toFixed(1), ci95: +(100 * 1.96 * sd / Math.sqrt(n || 1)).toFixed(1) };
}
for (const t of table) if (t.arm !== 'standard') t.vsStandard = paired(t.system, t.set, t.split, t.arm);

writeFileSync(join(OUT, 'report.json'), JSON.stringify({ generated: new Date().toISOString(), table }, null, 2));

const md = ['# OlaBench: results', '', `Generated: ${new Date().toISOString()}`, '',
  '| System | Set | Split | Arm | Model / effort | n | Score % | ±CI95 | vs standard (same items) | Errors | Avg sec | Tokens in/out |',
  '|---|---|---|---|---|---:|---:|---:|---|---:|---:|---|'];
for (const t of table) {
  const vs = t.vsStandard ? `${t.vsStandard.delta >= 0 ? '+' : ''}${t.vsStandard.delta} ±${t.vsStandard.ci95} (n=${t.vsStandard.n})` : '';
  md.push(`| ${t.system === 'nex' ? 'Nex 1.0' : t.system} | ${t.set} | ${t.split} | ${t.arm} | ${t.model} / ${t.effort ?? 'default'} | ${t.n} | ${t.score} | ${t.ci95} | ${vs} | ${t.errors} | ${t.avgSec} | ${t.avgTokens.input}/${t.avgTokens.output} |`);
}
const sq = table.filter((t) => t.simpleqa);
if (sq.length) {
  md.push('', '## SimpleQA Verified: official metrics', '', '| System | Split | Arm | Correct % | Correct given attempted % | F1 |', '|---|---|---|---:|---:|---:|');
  for (const t of sq) md.push(`| ${t.system === 'nex' ? 'Nex 1.0' : t.system} | ${t.split} | ${t.arm} | ${t.simpleqa.correct} | ${t.simpleqa.correctGivenAttempted} | ${t.simpleqa.f1} |`);
}
writeFileSync(join(OUT, 'report.md'), md.join('\n') + '\n');

// ARC Prize submission file, per system and arm.
const items = Object.fromEntries(arc.load().map((it) => [it.id, it]));
const subs = {};
for (const r of all) if (r.set === 'arc-agi-2') (subs[`${r.system}-${r.arm}`] ||= {})[r.item] = arc.submissionEntry(items[r.item], r.answer);
for (const [k, v] of Object.entries(subs)) writeFileSync(join(OUT, `arc-submission-${k}.json`), JSON.stringify(v));
console.log(md.join('\n'));
