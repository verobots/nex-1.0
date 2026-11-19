// Calls one model through a subscription CLI (codex, claude, agy): prompt on stdin, normalised output.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_EXE, CODEX_JS, AGY_EXE, AGY_SETTINGS, AGY_HOOKS, CLAUDE_CONFIG, QUOTA_PATTERNS } from '../config.mjs';

// route: { cli, model, effort }; returns { text, usage, sec, exit, timedOut, quota, tools }.
export function callModel(route, prompt, { cwd, timeoutMs, logBase, images = [] }) {
  mkdirSync(cwd, { recursive: true });
  if (images.length && route.cli !== 'codex') return Promise.resolve({ text: '', usage: null, error: `images not supported on ${route.cli}` });
  const { cmd, args, env, setup, input } = COMMANDS[route.cli](route, images);
  if (setup) setup(cwd);
  return new Promise((done) => {
    const start = Date.now();
    const child = spawn(cmd, args, { cwd, env, windowsHide: true });
    let out = '', err = '', timedOut = false;
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { err += String(e); });
    child.stdin.end(input ? input(prompt) : prompt);
    const timer = setTimeout(() => { timedOut = true; kill(child); }, timeoutMs);
    child.on('close', (exit) => {
      clearTimeout(timer);
      if (logBase) { writeFileSync(logBase + '.out', out); if (err) writeFileSync(logBase + '.err', err); }
      const parsed = PARSERS[route.cli](out);
      const quota = !parsed.text && QUOTA_PATTERNS.some((p) => p.test(out + err));
      done({ ...parsed, sec: Math.round((Date.now() - start) / 1000), exit, timedOut, quota });
    });
  });
}

// The CLIs start child processes; on Windows only taskkill /T stops the whole tree.
function kill(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true });
  else child.kill('SIGKILL');
}

const COMMANDS = {
  codex(r, images = []) {
    // read-only sandbox: the model can think and run read-only commands in its empty directory, nothing else.
    const base = ['exec', '--json', '-m', r.model, '--skip-git-repo-check', '-s', 'read-only'];
    if (r.effort) base.push('-c', `model_reasoning_effort="${r.effort}"`);
    // --image=<f>: the '=' form, otherwise -i also swallows '-' (the prompt on stdin).
    for (const f of images) base.push(`--image=${f}`);
    if (r.web) base.push('-c', 'web_search="live"');
    base.push('-');
    return CODEX_JS ? { cmd: process.execPath, args: [CODEX_JS, ...base], env: { ...process.env } } : { cmd: 'codex', args: base, env: { ...process.env } };
  },
  claude(r) {
    const env = { ...process.env, CLAUDE_CONFIG_DIR: CLAUDE_CONFIG };
    // A parent Claude Code session must not leak into the child.
    for (const k of Object.keys(env)) if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_') && k !== 'CLAUDE_CODE_OAUTH_TOKEN') delete env[k];
    mkdirSync(CLAUDE_CONFIG, { recursive: true });
    // --tools '' = no tools at all (no web, no files).
    const args = ['-p', '--model', r.model, '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence'];
    if (r.effort) args.push('--effort', r.effort);
    return { cmd: CLAUDE_EXE, args, env };
  },
  agy(r) {
    // agy 1.5.x: -p needs a value (-p= empty); the long prompt comes on stdin as stream-json.
    // Session settings block access outside the working directory; the hook in .agents/ denies every tool (web, files, commands).
    const args = ['--model', r.model, '--settings', JSON.stringify(AGY_SETTINGS), '--input-format', 'stream-json', '--output-format', 'stream-json', '-p='];
    if (r.effort) args.push('--effort', r.effort);
    return {
      cmd: AGY_EXE, args, env: { ...process.env },
      setup(cwd) { mkdirSync(join(cwd, '.agents'), { recursive: true }); writeFileSync(join(cwd, '.agents', 'hooks.json'), JSON.stringify(AGY_HOOKS)); },
      input: (p) => JSON.stringify({ event: 'user', message: { content: p } }) + '\n',
    };
  },
};

const PARSERS = {
  codex(out) {
    let text = '', usage = null;
    for (const line of out.split('\n')) {
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'item.completed' && ev.item?.type === 'agent_message') text = ev.item.text;
      if (ev.type === 'turn.completed' && ev.usage) usage = {
        input: ev.usage.input_tokens, cached: ev.usage.cached_input_tokens,
        output: ev.usage.output_tokens, reasoning: ev.usage.reasoning_output_tokens,
      };
    }
    return { text, usage };
  },
  claude(out) {
    let j; try { j = JSON.parse(out); } catch { return { text: '', usage: null }; }
    if (j.is_error) return { text: '', usage: null, error: String(j.result).slice(0, 300) };
    const u = j.usage || {};
    return {
      text: j.result || '',
      usage: { input: u.input_tokens, cached: u.cache_read_input_tokens, cacheWrite: u.cache_creation_input_tokens, output: u.output_tokens },
      models: Object.keys(j.modelUsage || {}),
    };
  },
  agy(out) {
    let j = null; const tools = [];
    for (const line of out.split('\n')) {
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.event === 'result') j = ev.result;
      const st = ev.step_update;
      if (st && st.step_type === 'tool' && st.state !== 'ACTIVE') tools.push(`${st.tool_name}:${st.state}`);
    }
    if (!j) return { text: '', usage: null };
    if (j.status !== 'SUCCESS') return { text: '', usage: null, error: String(j.error).slice(0, 300) };
    const u = j.usage || {};
    return { text: j.response || '', usage: { input: u.input_tokens, cached: u.cache_read_tokens, output: u.output_tokens, reasoning: u.thinking_tokens }, tools };
  },
};
