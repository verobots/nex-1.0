// MathArena AIME 2026 (30, integer answers 0-999) and HMMT Feb 2026 (33, LaTeX answers). Final answer in \boxed{}.
// AIME: exact integer match. HMMT: equal after normalisation, otherwise the judge decides mathematical equivalence.

import { readFileSync } from 'node:fs';
import { DATA, JUDGE } from '../../config.mjs';
import { callModel } from '../cli.mjs';

export function make(dir, integer) {
  return {
    load: () => readFileSync(`${DATA}/${dir}/items.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), split: 'measure' })),
    prompt: (item) => [
      'Solve the following competition math problem. Reason carefully and verify your result.',
      'Put your final answer within \\boxed{}' + (integer ? ' as an integer between 0 and 999.' : ' in simplest exact form.'),
      '', item.problem,
    ].join('\n'),
    async grade(item, text, { cwd, logBase }) {
      const ans = lastBoxed(text);
      if (ans == null) return { score: 0, detail: 'no \\boxed', answer: null };
      if (integer) {
        const n = ans.replace(/[^0-9-]/g, '');
        return { score: n !== '' && Number(n) === Number(item.answer) ? 1 : 0, detail: `${n}/${item.answer}`, answer: ans };
      }
      if (norm(ans) === norm(item.answer)) return { score: 1, detail: 'equal', answer: ans };
      const p = `Are these two final answers to the same math problem mathematically equivalent (same value or same set/expression, ignoring formatting)?\n\nProblem: ${item.problem}\n\nReference answer: ${item.answer}\nCandidate answer: ${ans}\n\nReply with exactly one word: YES or NO.`;
      for (let i = 0; i < 2; i++) {
        const r = await callModel(JUDGE, p, { cwd, timeoutMs: JUDGE.timeoutMin * 60000, logBase: logBase + '.judge' });
        const m = String(r.text).trim().match(/\b(YES|NO)\b/i);
        if (m) return { score: m[1].toUpperCase() === 'YES' ? 1 : 0, detail: `judge ${m[1].toUpperCase()}`, answer: ans };
        if (r.quota) return { error: 'judge: quota limit' };
      }
      return { error: 'judge gave no verdict' };
    },
  };
}

function lastBoxed(text) {
  const s = String(text); const i = s.lastIndexOf('\\boxed{');
  if (i < 0) return null;
  let d = 0, j = i + 7;
  for (; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}') { if (d === 0) break; d--; } }
  return s.slice(i + 7, j).trim();
}
function norm(s) { return String(s).replace(/\\left|\\right|\\!|\\,|\\;|\s|\$/g, '').replace(/\\dfrac|\\tfrac/g, '\\frac').toLowerCase(); }
