// ARC-AGI-2, public evaluation set (120 tasks, Apache-2.0). Score = mean over test inputs, 2 attempts each (official pass@2 rule).

import { readFileSync, readdirSync } from 'node:fs';
import { DATA } from '../../config.mjs';
const DIR = `${DATA}/arc-agi-2/ARC-AGI-2-main/data/evaluation`;

export function load() {
  return readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const t = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
    return { id: f.replace('.json', ''), train: t.train, test: t.test, split: 'measure' };
  });
}

export function prompt(item) {
  const parts = ['Solve this ARC-AGI-2 puzzle. Each grid is a JSON array of rows; each cell is a colour 0-9.', ''];
  item.train.forEach((p, i) => parts.push(`Example ${i + 1} input:`, grid(p.input), `Example ${i + 1} output:`, grid(p.output), ''));
  item.test.forEach((p, i) => parts.push(`Test input ${i + 1}:`, grid(p.input), ''));
  parts.push(
    `Give two attempts for the output of each of the ${item.test.length} test input(s); a test counts as solved if either attempt is exactly right.`,
    'End your reply with one fenced ```json block of this exact shape and nothing after it:',
    '{"attempts": [[<attempt_1 grid for test 1>, <attempt_2 grid for test 1>], ...one pair per test input]}',
  );
  return parts.join('\n');
}

export async function grade(item, text) {
  const ans = parseAttempts(text);
  if (!ans) return { score: 0, detail: 'reply without valid JSON' };
  let solved = 0;
  item.test.forEach((p, i) => {
    const pair = Array.isArray(ans[i]) ? ans[i] : [];
    if (pair.some((g) => same(g, p.output))) solved++;
  });
  return { score: solved / item.test.length, detail: `${solved}/${item.test.length}`, answer: ans };
}

// ARC Prize submission format: { task_id: [ { attempt_1, attempt_2 }, ... ] }.
export function submissionEntry(item, answer) {
  return item.test.map((_, i) => {
    const pair = Array.isArray(answer?.[i]) ? answer[i] : [];
    return { attempt_1: pair[0] ?? [[0]], attempt_2: pair[1] ?? pair[0] ?? [[0]] };
  });
}

function grid(g) { return '[' + g.map((r) => JSON.stringify(r)).join(',\n ') + ']'; }

function same(a, b) {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  return a.every((row, i) => Array.isArray(row) && row.length === b[i].length && row.every((v, j) => v === b[i][j]));
}

function parseAttempts(text) {
  const blocks = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const tail = String(text).slice(String(text).lastIndexOf('{"attempts"'));
  for (const c of [...blocks.reverse(), tail]) {
    try {
      const j = JSON.parse(c.trim());
      if (Array.isArray(j?.attempts)) return j.attempts;
    } catch { /* next candidate */ }
  }
  return null;
}
