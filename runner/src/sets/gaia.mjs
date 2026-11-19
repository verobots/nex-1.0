// GAIA 2023 (gaia-benchmark/GAIA, gated): general assistant with web search and attached files. validation (165) has answers; test (301) is scored only by the leaderboard server.
// The answer prompt is the one from the GAIA paper; local scoring ports scorer.py from the gaia-benchmark/leaderboard space.

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA } from '../../config.mjs';
const SYSTEM = 'You are a general AI assistant. I will ask you a question. Report your thoughts, and finish your answer with the following template: FINAL ANSWER: [YOUR FINAL ANSWER]. YOUR FINAL ANSWER should be a number OR as few words as possible OR a comma separated list of numbers and/or strings. If you are asked for a number, don\'t use comma to write your number neither use units such as $ or percent sign unless specified otherwise. If you are asked for a string, don\'t use articles, neither abbreviations (e.g. for cities), and write the digits in plain text unless specified otherwise. If you are asked for a comma separated list, apply the above rules depending of whether the element to be put in the list is a number or a string.';
const IMG = /\.(png|jpe?g|gif|webp)$/i;

export function load() {
  return ['validation', 'test'].flatMap((sp) => readFileSync(`${DATA}/gaia/${sp}/items.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
}

// The attached file is copied into the job's working directory (the only place the model may read).
export function setup(item, cwd) {
  mkdirSync(cwd, { recursive: true });
  if (item.file) copyFileSync(`${DATA}/gaia/${item.split}/${item.file}`, join(cwd, item.file));
}

export function images(item) { return item.file && IMG.test(item.file) ? [`${DATA}/gaia/${item.split}/${item.file}`] : []; }

export function prompt(item) {
  const att = item.file ? `\n\nAttached file: ./${item.file} (in the current directory; you may read it with shell commands such as python).` : '';
  return `${SYSTEM}\n\nQuestion: ${item.question}${att}`;
}

export async function grade(item, text) {
  const m = [...String(text).matchAll(/FINAL ANSWER\s*:\s*(.+)/gi)].pop();
  const ans = m ? m[1].trim().replace(/^\*+|\*+$/g, '').trim() : null;
  if (item.split === 'test') return { score: null, detail: 'not scored locally (test)', answer: ans };
  if (ans == null) return { score: 0, detail: 'no FINAL ANSWER', answer: null };
  return { score: scorer(ans, item.answer) ? 1 : 0, detail: `L${item.level}`, answer: ans };
}

// Faithful port of scorer.py (gaia-benchmark/leaderboard).
function isFloat(s) { return String(s).trim() !== '' && !Number.isNaN(Number(String(s).trim())); }
function normNum(s) { const t = String(s).replace(/[$%,]/g, '').trim(); return isFloat(t) ? Number(t) : Infinity; }
function normStr(s, punct = true) { const t = String(s).replace(/\s/g, '').toLowerCase(); return punct ? t.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '') : t; }
export function scorer(ma, gt) {
  if (isFloat(gt)) return normNum(ma) === Number(gt);
  if (/[,;]/.test(gt)) {
    const g = gt.split(/[,;]/), a = String(ma).split(/[,;]/);
    if (g.length !== a.length) return false;
    return g.every((ge, i) => (isFloat(ge) ? normNum(a[i]) === Number(ge) : normStr(a[i], false) === normStr(ge, false)));
  }
  return normStr(ma) === normStr(gt);
}
