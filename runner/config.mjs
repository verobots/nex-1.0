// Nex 1.0 / OlaBench configuration: every tunable value lives here.

// 1. Paths and environment
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = process.env.OLABENCH_DATA || `${ROOT}/data`;
// Each job runs in its own empty working directory, outside any project, so the CLIs load no project rules.
export const ARENA = process.env.OLABENCH_ARENA || join(tmpdir(), 'olabench', 'arena');
// Clean Claude config dir (no global CLAUDE.md, hooks or skills). Auth: CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`).
export const CLAUDE_CONFIG = process.env.OLABENCH_CLAUDE_CONFIG || join(tmpdir(), 'olabench', 'claude-config');
// Executables of the subscription CLIs. CODEX_JS = path to @openai/codex/bin/codex.js (run with the current node).
export const CLAUDE_EXE = process.env.OLABENCH_CLAUDE_EXE || 'claude';
export const CODEX_JS = process.env.OLABENCH_CODEX_JS || '';
export const AGY_EXE = process.env.OLABENCH_AGY_EXE || 'agy';
// agy (Antigravity CLI): no access outside the working directory, and a PreToolUse hook denies every tool (checked 2026-11-18, agy 1.5.11).
export const AGY_SETTINGS = { allowNonWorkspaceAccess: false, trustedWorkspaces: [] };
export const AGY_HOOKS = { 'olabench-no-tools': { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo {"decision":"deny","reason":"Tools are disabled for this benchmark task. Answer directly."}', timeout: 10 }] }] } };

// 2. Nex 1.0 (the router)
// Route = test category -> the model with the highest public score on that kind of test, at its maximum reasoning effort.
// Cost and tokens are recorded but never used for routing.
export const ROUTES = {
  'abstract-reasoning': { cli: 'codex', model: 'gpt-6.2-astra', effort: 'max', why: 'ARC-AGI-2: official ARC Prize leader' },
  'factuality': { cli: 'claude', model: 'claude-fable-5-2', effort: 'max', why: 'SimpleQA Verified: best public score (Epoch AI)' },
  'science-qa': { cli: 'codex', model: 'gpt-6.2-astra', effort: 'max', why: 'GPQA Diamond: best public score (Epoch AI)' },
  'office-agent': { cli: 'agy', model: 'gemini-4-carbon-high', effort: null, why: 'APEX-Agents: best public score (Epoch AI); max accepted effort = high' },
  'default': { cli: 'claude', model: 'claude-fable-5-2', effort: 'max', why: 'wins the most Epoch AI benchmarks among the candidate models' },
};
// Single models for comparison runs (--system <name>), each at maximum effort.
export const MODELS = {
  'gpt-6.2-astra': { cli: 'codex', model: 'gpt-6.2-astra', effort: 'max' },
  'gpt-6.2-sol': { cli: 'codex', model: 'gpt-6.2-sol', effort: 'max' },
  'claude-fable-5-2': { cli: 'claude', model: 'claude-fable-5-2', effort: 'max' },
  'claude-opus-5-5': { cli: 'claude', model: 'claude-opus-5-5', effort: 'max' },
  'gemini-4-hydrogen-xhigh': { cli: 'agy', model: 'gemini-4-hydrogen-xhigh', effort: null },
};

// 3. Sets and arms
// standard = the test prompt only; workspace = general working rules, nothing about the test; skill = workspace + the test's skill.
export const ARMS = ['standard', 'workspace', 'skill'];
export const SETS = {
  'arc-agi-2': { route: 'abstract-reasoning', timeoutMin: 45, skill: 'arc-agi-2.md' },
  'simpleqa-verified': { route: 'factuality', timeoutMin: 12, skill: 'simpleqa-verified.md', tune: 50, measure: 300, seed: 20261118 },
};
// SimpleQA judge: a different model family from the judged model, official simple-evals grading template.
export const JUDGE = { cli: 'codex', model: 'gpt-6.1-sol', effort: 'medium', timeoutMin: 6 };

// 4. Execution
// Concurrent jobs per CLI (subscription quotas are separate per provider).
export const CONCURRENCY = { codex: 4, claude: 4, agy: 2 };
// After a quota limit: pause (minutes) before retrying; after MAX_TRIES failures the job stays marked as error.
export const QUOTA_PAUSE_MIN = 20;
export const MAX_TRIES = 3;
// CLI output patterns that mean a quota/subscription limit, not a wrong answer.
export const QUOTA_PATTERNS = [/usage limit/i, /rate limit/i, /quota/i, /429/, /too many requests/i, /limit reached/i, /overloaded/i];
// Instruction shared by all arms (the CLIs may load global rule files; the test does not need them).
export const ISOLATION = 'This is a self-contained task. Do not read, search or modify any files outside the current directory and do not use the web. Answer only from the task below.';
