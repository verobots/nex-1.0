// SimpleQA Verified (Google DeepMind): 1,000 factual questions, no tools.
// Items are shuffled deterministically; the first `tune` items were used to write the skill, the next `measure` items are measured.

import { readFileSync } from 'node:fs';
import { DATA, ROOT, SETS, JUDGE } from '../../config.mjs';
import { callModel } from '../cli.mjs';
const CSV = `${DATA}/simpleqa-verified/simpleqa_verified.csv`;
const TEMPLATE = readFileSync(`${ROOT}/runner/graders/simpleqa-grader.txt`, 'utf8').split('\n').slice(1).join('\n');

export function load() {
  const cfg = SETS['simpleqa-verified'];
  const [head, ...rows] = parseCsv(readFileSync(CSV, 'utf8'));
  const items = rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  shuffle(items, cfg.seed);
  return items.slice(0, cfg.tune + cfg.measure).map((r, i) => ({
    id: `sq${r.original_index}`, question: r.problem, gold: r.answer, topic: r.topic, split: i < cfg.tune ? 'tune' : 'measure',
  }));
}

export function prompt(item) { return item.question; }

// Official grade: A = correct, B = incorrect, C = not attempted. Item score = 1 only for A.
export async function grade(item, text, { cwd, logBase }) {
  const p = TEMPLATE.replace('{question}', item.question).replace('{target}', item.gold).replace('{predicted_answer}', String(text).trim());
  for (let i = 0; i < 2; i++) {
    const r = await callModel(JUDGE, p, { cwd, timeoutMs: JUDGE.timeoutMin * 60000, logBase: logBase + '.judge' });
    const m = String(r.text).trim().match(/^\W*([ABC])\b/);
    if (m) return { score: m[1] === 'A' ? 1 : 0, detail: { A: 'CORRECT', B: 'INCORRECT', C: 'NOT_ATTEMPTED' }[m[1]] };
    if (r.quota) return { error: 'judge: quota limit' };
  }
  return { error: 'judge gave no grade' };
}

// SimpleQA also reports F1 between "correct" and "correct given attempted".
export function summary(rows) {
  const n = rows.length, c = rows.filter((r) => r.detail === 'CORRECT').length;
  const att = rows.filter((r) => r.detail !== 'NOT_ATTEMPTED').length;
  const cga = att ? c / att : 0, acc = n ? c / n : 0;
  return { correct: acc, correctGivenAttempted: cga, f1: acc + cga ? (2 * acc * cga) / (acc + cga) : 0 };
}

function parseCsv(s) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// mulberry32: reproducible shuffle, same seed = same items on every run.
function shuffle(a, seed) {
  let t = seed >>> 0;
  const rnd = () => { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
}
