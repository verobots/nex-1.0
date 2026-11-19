// Humanity's Last Exam (cais/hle, gated): 2,500 questions, 342 with an image. System prompt and judge are the official ones (centerforaisafety/hle, MIT).
// Dataset terms: questions are not published; results contain only ids, the extracted answer and the verdict.

import { readFileSync } from 'node:fs';
import { DATA, ROOT, JUDGE } from '../../config.mjs';
import { callModel } from '../cli.mjs';
const SYSTEM = 'Your response should be in the following format:\nExplanation: {your explanation for your answer choice}\nAnswer: {your chosen answer}\nConfidence: {your confidence score between 0% and 100% for your answer}';
const JUDGE_PROMPT = readFileSync(`${ROOT}/runner/graders/hle-judge.txt`, 'utf8').split('\n').slice(1).join('\n');

export function load() {
  return readFileSync(`${DATA}/hle/items.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), split: 'measure' }));
}

export function prompt(item) {
  return `${SYSTEM}\n\n${item.image ? '(The image attached to this message is part of the question.)\n\n' : ''}${item.question}`;
}

export function images(item) { return item.image ? [`${DATA}/hle/img/${item.image}`] : []; }

export async function grade(item, text, { cwd, logBase }) {
  const p = JUDGE_PROMPT.replace('{question}', item.question).replace('{response}', String(text).trim()).replace('{correct_answer}', item.answer)
    + '\n\nEnd your reply with these four lines exactly:\nextracted_final_answer: ...\nreasoning: ...\ncorrect: yes|no\nconfidence: <integer>';
  for (let i = 0; i < 2; i++) {
    const r = await callModel(JUDGE, p, { cwd, timeoutMs: JUDGE.timeoutMin * 60000, logBase: logBase + '.judge' });
    const m = [...String(r.text).matchAll(/correct\s*:\s*\**\s*(yes|no)\b/gi)].pop();
    if (m) {
      const conf = [...String(r.text).matchAll(/confidence\s*:\s*\**\s*(\d+)/gi)].pop();
      const ex = [...String(r.text).matchAll(/extracted_final_answer\s*:\s*(.*)/gi)].pop();
      return { score: m[1].toLowerCase() === 'yes' ? 1 : 0, detail: m[1].toLowerCase(), answer: ex ? ex[1].trim().slice(0, 300) : null, confidence: conf ? Number(conf[1]) : 100 };
    }
    if (r.quota) return { error: 'judge: quota limit' };
  }
  return { error: 'judge gave no verdict' };
}
