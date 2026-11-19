// GPQA Diamond (Idavidrein/gpqa, CC-BY-4.0, gated): 198 four-option questions. Options are shuffled deterministically per item (like shuffle_choices in eval.yaml); the answer is a letter.
// Dataset terms: questions must not be published in plain text; results contain only ids and letters.

import { readFileSync } from 'node:fs';
import { DATA } from '../../config.mjs';
const FILE = `${DATA}/gpqa/items.jsonl`;
const LETTERS = ['A', 'B', 'C', 'D'];

export function load() {
  return readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => {
    const r = JSON.parse(l);
    const opts = [r.correct, ...r.incorrect];
    const order = shuffled([0, 1, 2, 3], seedOf(r.id));
    return { id: r.id, question: r.question, choices: order.map((i) => opts[i]), gold: LETTERS[order.indexOf(0)], split: 'measure' };
  });
}

export function prompt(item) {
  return [
    'Answer the following multiple choice question. Think step by step, then give your final answer.',
    'The last line of your reply must be exactly of the form "ANSWER: X", where X is one of A, B, C, D.',
    '', item.question, '',
    ...item.choices.map((c, i) => `${LETTERS[i]}) ${c}`),
  ].join('\n');
}

export async function grade(item, text) {
  const m = [...String(text).matchAll(/ANSWER\s*[:：]\s*\**\s*\(?([ABCD])\b/gi)].pop();
  if (!m) return { score: 0, detail: 'no letter' };
  const a = m[1].toUpperCase();
  return { score: a === item.gold ? 1 : 0, detail: `${a}/${item.gold}`, answer: a };
}

// Stable seed from the id (FNV-1a), then mulberry32: same option order on every run.
function seedOf(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffled(a, seed) {
  let t = seed;
  const rnd = () => { t += 0x6D2B79F5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
