# Nex 1.0 (Verobots)

Nex 1.0 is a small routing harness over frontier models. For each benchmark it does two things:

1. **Route** the task category to the model with the strongest public score on that kind of test, at its maximum reasoning effort (cost is recorded but never used for routing).
2. **Add a per-benchmark skill**: a short instruction file written only from the benchmark's public description and its public training data, never from evaluation items or answers.

Every result is measured in three arms on the same items, so the effect of each layer is visible:

| Arm | Prompt |
|---|---|
| `standard` | isolation line + the benchmark prompt |
| `workspace` | + general working rules ([arms/workspace.md](arms/workspace.md)), nothing about the test |
| `skill` | + the benchmark skill ([skills/](skills)) |

The models are called through their official subscription CLIs (`codex exec`, `claude -p`, `agy`), each job in its own empty directory, with no web access and no tools (details below).

## Results

Self-reported, not verified by the benchmark organisers. Full table: [results/report.md](results/report.md); per-item rows: [results/results.jsonl](results/results.jsonl).

**ARC-AGI-2, public evaluation set (120 tasks), pass@2, routed to `gpt-6.2-astra` at `max` effort**

| Arm | Score | ±95% CI | vs standard (paired, same tasks) |
|---|---:|---:|---|
| skill | 98.8% | 1.8 | +0.8 ±2.8 |
| workspace | 98.8% | 1.8 | +0.8 ±2.8 |
| standard | 97.9% | 2.1 | |

Prediction files in the ARC Prize format: [results/arc-agi-2/](results/arc-agi-2) (`arc-submission-nex-skill.json` is the main entry).

**SimpleQA Verified (300 measured items, seeded shuffle), routed to `claude-fable-5-2` at `max` effort, graded by `gpt-6.1-sol` with the simple-evals template**

| Arm | Correct | ±95% CI | vs standard (paired) |
|---|---:|---:|---|
| skill | 97.0% (299 graded, 1 timeout) | 1.9 | +1.0 ±1.7 |
| workspace | 96.3% | 2.1 | +0.7 ±1.8 |
| standard | 95.7% | 2.3 | |

**Official Hugging Face benchmark leaderboards** (results reported from the model repo [verobots/nex-1.0](https://huggingface.co/verobots/nex-1.0) via `.eval_results/`; per-item rows in [results/](results)):

| Benchmark (HF dataset) | Route | Nex 1.0 (skill arm) | Status |
|---|---|---:|---|
| AIME 2026 (`MathArena/aime_2026`) | `gpt-6.2-astra` / max | 100.0% (30/30) | published |
| HMMT Feb 2026 (`MathArena/hmmt_feb_2026`) | `gpt-6.2-astra` / max | | running |
| GPQA Diamond (`Idavidrein/gpqa`, task `diamond`) | `gpt-6.2-astra` / max | | running |
| Humanity's Last Exam (`cais/hle`) | `gpt-6.2-astra` / max | | running |

GPQA and HLE questions are never published here (dataset terms); result rows contain only item ids, the extracted answer and the grade. GAIA (web + files, route `web-agent`) is submitted to the official [GAIA leaderboard](https://huggingface.co/spaces/gaia-benchmark/leaderboard), which scores the hidden test answers itself.

### Read these numbers carefully

- **ARC-AGI-2 here is the public evaluation set**, not the semi-private set that ARC Prize uses for verified scores. The public set has been online since 2025 and may be in the models' training data. Treat 98.8% as an upper bound, not as a verified ARC-AGI-2 score.
- **The skill gain is inside the noise** on both benchmarks (the paired 95% interval crosses zero). We do not claim that the skills improve the score; the experiment is published so others can check.
- Most of the score comes from the routed model itself (`standard` arm). The harness contribution claimed here is the method (routing + public-only skills + three-arm paired measurement), not a large score gain.

## Harness declaration

- **No web, no external files.** Every prompt starts with an isolation instruction. Codex runs with `-s read-only` in an empty directory; Claude runs with `--tools ''`; agy runs with workspace-only settings and a `PreToolUse` hook that denies every tool. In the 360 ARC runs, the Codex event logs contain no `command_execution`, `web_search`, `file_change` or MCP tool call events.
- **Global instruction files.** The Codex CLI loads the user's global `~/.codex/AGENTS.md` if one exists. On the machine that produced these results it is a short redirect note (pointing to local rule files, nothing about ARC); since no command was executed in any run, those files were never read. The isolation instruction tells the model to ignore anything outside the task. Claude runs with a clean `CLAUDE_CONFIG_DIR`.
- **Skills** were written from the public descriptions (arcprize.org and the ARC-AGI-2 technical report; the SimpleQA / SimpleQA Verified papers) and, for ARC, the public training set. For SimpleQA the first 50 shuffled items were reserved for writing the skill; the 300 measured items come after them.
- **Retries** happen only on quota/rate-limit errors (the job goes back to the queue). Wrong answers are never retried.
- **Cost** is not reported: the runs used flat-rate subscriptions, not metered API keys.

## Reproduce

Requirements: Node.js 20+, and logged-in CLIs for the providers you route to (`codex`, `claude`, `agy`). No npm dependencies.

```bash
# data (paths are relative to the repo; override with OLABENCH_DATA)
mkdir -p data/arc-agi-2 data/simpleqa-verified
curl -L -o data/arc-agi-2/repo.zip https://github.com/arcprize/ARC-AGI-2/archive/refs/heads/main.zip
unzip -q data/arc-agi-2/repo.zip -d data/arc-agi-2            # -> data/arc-agi-2/ARC-AGI-2-main/data/evaluation
curl -L -o data/simpleqa-verified/simpleqa_verified.csv \
  https://huggingface.co/datasets/google/simpleqa-verified/resolve/main/simpleqa_verified.csv

# CLI locations (Windows: point to the real executables, not .cmd shims)
export OLABENCH_CODEX_JS=/path/to/@openai/codex/bin/codex.js   # or leave empty to call `codex`
export OLABENCH_CLAUDE_EXE=claude
export CLAUDE_CODE_OAUTH_TOKEN=...                              # from `claude setup-token`

# Hugging Face sets (gated ones need an accepted license + HF token): download into data/<set>/ and convert
python runner/prep/hf-sets.py

node runner/run.mjs --out out/nex --sets arc-agi-2,simpleqa-verified --arms skill,standard,workspace
node runner/run.mjs --out out/nex-hf --sets aime-2026,hmmt-feb-2026,gpqa-diamond --arms skill,standard
node runner/publish-hf.mjs <hf-model-repo-clone> out/nex-hf    # writes .eval_results/*.yaml for complete sets
node runner/report.mjs out/nex     # report.md, report.json, arc-submission-<system>-<arm>.json
```

Useful flags: `--limit N` (first N items), `--system <model>` (run a single model from `MODELS` instead of the router), `--split tune|measure|all`. Runs are resumable; a `STOP` file in the output folder stops them cleanly.

## Layout

| Path | Content |
|---|---|
| [runner/config.mjs](runner/config.mjs) | Routes, models, sets, arms, concurrency, quota handling |
| [runner/run.mjs](runner/run.mjs) | Job queue per CLI, resumable results |
| [runner/src/cli.mjs](runner/src/cli.mjs) | How each CLI is called and parsed |
| [runner/src/sets/](runner/src/sets) | Loader, prompt and grader per benchmark |
| [runner/report.mjs](runner/report.mjs) | Scores, confidence intervals, paired differences, ARC submission file |
| [skills/](skills), [arms/](arms) | The per-benchmark skills and the general working rules |

Third-party content: `runner/graders/simpleqa-grader.txt` is the grading template from [openai/simple-evals](https://github.com/openai/simple-evals) (MIT License).

Contact: contact@verobots.net · https://verobots.net
