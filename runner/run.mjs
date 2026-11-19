// OlaBench: runs "Nex 1.0" (the router + arms) or a single model on the public sets. Resumable, no duplicates.
// Usage: node run.mjs --out <dosar> --sets arc-agi-2,simpleqa-verified --arms skill,standard [--system nex|<model>] [--limit N] [--split measure|tune|all]
// Clean stop: create a STOP file in the --out folder. Results: <out>/results.jsonl (one line per finished job).

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, ARENA, ROUTES, MODELS, SETS, ARMS, CONCURRENCY, QUOTA_PAUSE_MIN, MAX_TRIES, ISOLATION } from './config.mjs';
import { callModel } from './src/cli.mjs';
import * as arc from './src/sets/arc.mjs';
import * as simpleqa from './src/sets/simpleqa.mjs';

const SET_MODULES = { 'arc-agi-2': arc, 'simpleqa-verified': simpleqa };
const argv = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(' '); return [k, v.join(' ') || true]; }));
const OUT = argv.out;
if (!OUT) { console.error('missing --out'); process.exit(2); }
const SYSTEM = argv.system || 'nex';
const sets = String(argv.sets || Object.keys(SETS).join(',')).split(',');
const arms = String(argv.arms || ARMS.join(',')).split(',');
const split = argv.split || 'measure';
const limit = argv.limit ? Number(argv.limit) : Infinity;
const RES = join(OUT, 'results.jsonl');
mkdirSync(join(OUT, 'logs'), { recursive: true });
const log = (...a) => { const l = new Date().toISOString() + ' ' + a.join(' '); console.log(l); appendFileSync(join(OUT, 'run.log'), l + '\n'); };

// Nex 1.0 = the set's route (champion model at maximum effort); otherwise the requested model, on the same arms.
function routeFor(set) { return SYSTEM === 'nex' ? ROUTES[SETS[set].route] || ROUTES.default : MODELS[SYSTEM]; }

function armText(set, arm) {
  const parts = [ISOLATION];
  if (arm !== 'standard') parts.push(readFileSync(join(ROOT, 'arms', 'workspace.md'), 'utf8').trim());
  if (arm === 'skill') parts.push(readFileSync(join(ROOT, 'skills', SETS[set].skill), 'utf8').trim());
  return parts.join('\n\n---\n\n');
}

function done() {
  const seen = new Map();
  if (!existsSync(RES)) return seen;
  for (const l of readFileSync(RES, 'utf8').split('\n')) { if (!l) continue; const r = JSON.parse(l); seen.set(r.key, r); }
  return seen;
}

function buildJobs() {
  const prev = done(), jobs = [];
  for (const set of sets) {
    const items = SET_MODULES[set].load().filter((it) => split === 'all' || it.split === split).slice(0, limit);
    for (const arm of arms) for (const item of items) {
      const key = `${SYSTEM}|${set}|${arm}|${item.id}`;
      const p = prev.get(key);
      if (p && (p.status === 'ok' || (p.tries || 1) >= MAX_TRIES)) continue;
      jobs.push({ key, set, arm, item, route: routeFor(set), tries: p ? p.tries || 1 : 0 });
    }
  }
  return jobs;
}

async function runJob(job) {
  const safe = job.key.replace(/[|.:]/g, '_');
  const cwd = join(ARENA, safe);
  const mod = SET_MODULES[job.set];
  const text = armText(job.set, job.arm) + '\n\n---\n\n' + mod.prompt(job.item);
  const r = await callModel(job.route, text, { cwd, timeoutMs: SETS[job.set].timeoutMin * 60000, logBase: join(OUT, 'logs', safe) });
  if (r.quota) return { quota: true };
  const base = {
    key: job.key, system: SYSTEM, set: job.set, arm: job.arm, item: job.item.id, split: job.item.split,
    cli: job.route.cli, model: job.route.model, effort: job.route.effort, sec: r.sec, exit: r.exit, timedOut: r.timedOut,
    usage: r.usage, tools: r.tools, at: new Date().toISOString(), tries: job.tries + 1,
  };
  if (!r.text) return { row: { ...base, status: 'error', error: r.error || (r.timedOut ? 'timeout' : `exit ${r.exit}, no text`) } };
  writeFileSync(join(OUT, 'logs', safe + '.answer.md'), r.text);
  const g = await mod.grade(job.item, r.text, { cwd, logBase: join(OUT, 'logs', safe) });
  if (g.error) return { row: { ...base, status: 'error', error: g.error } };
  return { row: { ...base, status: 'ok', score: g.score, detail: g.detail, answer: g.answer } };
}

const pausedUntil = {};
async function worker(cli, queue, id) {
  while (queue.length) {
    if (existsSync(join(OUT, 'STOP'))) { log('STOP found, worker', cli, id, 'stops'); return; }
    const wait = (pausedUntil[cli] || 0) - Date.now();
    if (wait > 0) { await new Promise((ok) => setTimeout(ok, Math.min(wait, 60000))); continue; }
    const job = queue.shift();
    log('start', job.key, job.route.model);
    let res;
    try { res = await runJob(job); } catch (e) { res = { row: { key: job.key, system: SYSTEM, set: job.set, arm: job.arm, item: job.item.id, status: 'error', error: String(e).slice(0, 300), tries: job.tries + 1 } }; }
    if (res.quota) {
      pausedUntil[cli] = Date.now() + QUOTA_PAUSE_MIN * 60000;
      log('quota limit on', cli, '- pause', QUOTA_PAUSE_MIN, 'min; job goes back to the queue');
      queue.push(job);
      continue;
    }
    appendFileSync(RES, JSON.stringify(res.row) + '\n');
    log('done', job.key, res.row.status, res.row.score ?? res.row.error, `${res.row.sec ?? '?'}s`);
  }
}

async function main() {
  const lock = join(OUT, 'run.lock');
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    try { process.kill(pid, 0); log('another runner is active (pid', pid + '), exiting'); return; } catch { /* stale lock */ }
  }
  writeFileSync(lock, String(process.pid));
  const jobs = buildJobs();
  log(`start system=${SYSTEM} sets=${sets} arms=${arms} split=${split} jobs=${jobs.length}`);
  const byCli = {};
  for (const j of jobs) (byCli[j.route.cli] ||= []).push(j);
  const workers = [];
  for (const [cli, q] of Object.entries(byCli)) for (let i = 0; i < (CONCURRENCY[cli] || 1); i++) workers.push(worker(cli, q, i));
  await Promise.all(workers);
  rmSync(lock, { force: true });
  log('FINISHED', `left=${Object.values(byCli).reduce((s, q) => s + q.length, 0)}`);
}

await main();
