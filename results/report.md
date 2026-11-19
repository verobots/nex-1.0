# OlaBench: results

Generated: 2026-11-19T14:02:58.513Z

| System | Set | Split | Arm | Model / effort | n | Score % | ±CI95 | vs standard (same items) | Errors | Avg sec | Tokens in/out |
|---|---|---|---|---|---:|---:|---:|---|---:|---:|---|
| Nex 1.0 | arc-agi-2 | measure | skill | gpt-6.2-astra / max | 120 | 98.8 | 1.8 | +0.8 ±2.8 (n=120) | 0 | 354 | 276286/13519 |
| Nex 1.0 | arc-agi-2 | measure | standard | gpt-6.2-astra / max | 120 | 97.9 | 2.1 |  | 0 | 283 | 187990/10879 |
| Nex 1.0 | arc-agi-2 | measure | workspace | gpt-6.2-astra / max | 120 | 98.8 | 1.8 | +0.8 ±2.8 (n=120) | 0 | 279 | 202368/11658 |
| Nex 1.0 | simpleqa-verified | measure | skill | claude-fable-5-2 / max | 299 | 97 | 1.9 | +1 ±1.7 (n=299) | 1 | 10 | 5786/906 |
| Nex 1.0 | simpleqa-verified | measure | standard | claude-fable-5-2 / max | 300 | 95.7 | 2.3 |  | 0 | 9 | 5008/768 |
| Nex 1.0 | simpleqa-verified | measure | workspace | claude-fable-5-2 / max | 300 | 96.3 | 2.1 | +0.7 ±1.8 (n=300) | 0 | 11 | 5230/949 |

## SimpleQA Verified: official metrics

| System | Split | Arm | Correct % | Correct given attempted % | F1 |
|---|---|---|---:|---:|---:|
| Nex 1.0 | measure | skill | 97 | 97 | 97 |
| Nex 1.0 | measure | standard | 95.7 | 95.7 | 95.7 |
| Nex 1.0 | measure | workspace | 96.3 | 96.3 | 96.3 |
