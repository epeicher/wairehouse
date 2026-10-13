# Comments A/B: does inline code commentary help an agent?

Same prompt, same model, run N times on `trunk` (commented) and on
`codex/remove-code-comments` (stripped), each run in a fresh shared clone
pinned to the commit each arm had when the run started.
Measures tokens, wall time, turns and cost per run, runs the project's
gates, and has a context-free judge score every diff blind.

```
TASK=keep-on-top ./run.sh      # RUNS=3 MODEL=... EFFORT=... to override
./judge.sh results/<dir>       # JUDGE_MODEL=... to override; task read from config.txt
python3 -I summarize.py results/<dir>              # --without F to drop a criterion
# Pin an arm, or add runs to an existing results dir:
ARM_A=trunk ARM_A_AT=644a9976 ARM_B=... ARM_B_AT=... ./run.sh
APPEND=1 FIRST_RUN=3 RUNS=1 LABELS="R04 R07" OUT=results/<dir> ./run.sh
```

Tasks live under `tasks/<name>/`: `prompt.md` is what the agent gets,
`rubric.md` the judge's scoring guide, and an optional `hidden.test.ts` is a
vitest file the harness copies into the clone AFTER the agent finishes,
runs as the `hidden` gate, and removes before the diff is taken. The agent
never sees it, so it can only pass by implementing the behaviour the prompt
asked for. Its per-case lines (`hidden.txt`) are shown to the judge.

| Task | Hidden test | Notes |
|---|---|---|
| `tile-all-windows` | no | first task; `tile()` already existed, weakly discriminating |
| `keep-on-top` | yes, 5 cases | nothing to reuse; stacking, title bar and session all touched |

Per run you get `agent.json` (Claude Code's result document with `usage`),
`gates.csv`, `diff.patch`, `diff-blind.patch` (what the judge sees) and
`scores.json`. `key.csv` maps blind labels to arms; don't show it to the
judge.

Notes:
- The agent runs with `--permission-mode acceptEdits` and a fixed
  allowlist of Bash commands (npm scripts, git read-only, ls/grep/cat...).
  Anything else is denied, identically in both arms. Check `agent.stderr`
  after a smoke run and widen `AGENT_TOOLS` in `run.sh` if needed.
- `--setting-sources project` keeps your user settings, plugins and MCP
  servers out of the run. CLAUDE.md/AGENTS.md from the clone still load.
- Each run is a `git clone --shared` of the main checkout, detached at the
  arm's commit, not a worktree: a worktree shares refs, so a branch the
  agent made landed in the main repo and had to be deleted afterwards, and
  that cleanup once aborted the run on a branch the user had just created.
  Arms are resolved to commits once at start, so a `git pull` on trunk
  mid-run no longer changes the base of later runs (it did once; that run is
  kept apart in `results/keep-on-top-nodocs-extra`).
- `node_modules` is hard-linked from the main checkout; `vendor` is
  symlinked for phpcs.
- `GATE_BUILD=1` adds `npm run build` as a gate (minutes per run).
- Do a `RUNS=1` smoke run first and read one `agent.json` to confirm the
  `usage` fields are populated before spending on the full six.

## Results so far

Both arms at the same commits (trunk 28038e9f, stripped 09f2b460), Opus 5.5,
effort high, 3 runs per arm, blind judge on the default model. Tokens are
input + output + cache read + cache create.

| Task | Arm | Score | Wall | Turns | Cost | Tokens |
|---|---|---|---|---|---|---|
| tile-all-windows (max 19) | trunk | 18.3±1.2 | 246±13 s | 37±5 | $1.42±0.03 | 2.18M±0.17M |
| | stripped | 19.0±0.0 | 190±33 s | 31±5 | $1.04±0.06 | 1.71M±0.33M |
| keep-on-top (max 23) | trunk | 21.7±0.6 | 551±35 s | 110±13 | $3.84±0.36 | 9.06M±1.00M |
| | stripped | 22.0±0.0 | 522±65 s | 116±19 | $3.95±0.60 | 9.12M±1.88M |

keep-on-top: every run passed all gates and all five hidden cases, and every
run found the PHP session sanitizer on its own. Points were lost only for
unrequested public surface (an open-time config option, a new hook or event)
and once for an incomplete doc update. Results dirs: `results/full` (tiling),
`results/keep-on-top-full`; smoke passes beside them.

### Third experiment: no comments, no docs, no AGENTS.md (2026-10-09)

Same keep-on-top prompt, rubric and hidden test. Arm A is trunk 644a9976;
arm B is `codex/remove-code-comments-and-docs` 60e5cded, which is the
stripped branch minus `docs/`, `AGENTS.md`, `CLAUDE.md`, the wiki builder
and the two tests that read those files. Opus 5.5, effort high, 3 runs per
arm. Criterion F (docs updated) is lost by construction on arm B, so the
score is given with and without it.

| Arm | Score /23 | Score without F /21 | Wall | Turns | Cost | Tokens |
|---|---|---|---|---|---|---|
| trunk | 21.3±0.6 | 19.3±0.6 | 677±105 s | 123±17 | $4.84±0.92 | 11.6M±3.2M |
| no comments, docs or AGENTS.md | 18.7±0.6 | 18.7±0.6 | 461±74 s | 91±5 | $2.88±0.06 | 6.2M±0.4M |

Every run passed all gates and all five hidden cases, and every run found the
PHP session sanitizer. The no-guidance arm scored 3/3 on the mechanism
criterion (C) in all three runs, trunk only once: both trunk runs that lost
a point pinned restored windows after opening instead of seeding the restore
state. The no-guidance arm lost its points on conventions AGENTS.md spells
out: every run put its tests in a brand-new file (E 1/2; AGENTS.md says to
extend an existing one) and one run did not report running `npm run build`
(H 0/1). Both arms added unrequested public surface in every run (G 1/2).

Cost is where the arms separate: the no-guidance arm used 47% fewer tokens,
40% less money and 32% less wall time. In the second experiment stripping
comments alone left tokens unchanged (9.1M both arms), so the saving here
comes from not reading `docs/` and AGENTS.md, not from the comments.

A seventh run exists apart, in `results/keep-on-top-nodocs-extra`: the first
launch resolved `trunk` by name and a `git pull` moved it to 67944f97
mid-run, so that trunk run has a different base. It scored 21/23 at 12.9M
tokens, in line with the trunk arm. Results dir: `results/keep-on-top-nodocs`.

### Fourth experiment: trunk with and without docs and AGENTS.md (2026-10-09)

Same prompt, rubric and hidden test. Arm A is trunk 644a9976; arm B is
`codex/remove-docs` 68cb9fd7, which is that same commit with `docs/`,
`AGENTS.md`, `CLAUDE.md`, the wiki builder and the two tests that read those
files removed, comments intact. Opus 5.5, effort high, 3 runs per arm. This
isolates the docs and the guide from the comments.

| Arm | Score /23 | Score without F /21 | Wall | Turns | Cost | Tokens |
|---|---|---|---|---|---|---|
| trunk | 21.3±0.6 | 19.3±0.6 | 640±61 s | 131±14 | $4.77±0.65 | 11.6M±2.2M |
| trunk minus docs and AGENTS.md | 18.7±0.6 | 18.7±0.6 | 542±136 s | 108±11 | $4.25±0.45 | 7.8M±2.3M |

Same quality picture as the third experiment: all gates and hidden cases
passed in every run, every run found the PHP sanitizer, the no-guidance arm
scored 3/3 on the mechanism criterion in all three runs (trunk 2/3), and it
lost its points on AGENTS.md conventions: no run reported running `npm run
build` (H 0/1, all three) and two put their tests in a new file (E 1/2; one
trunk run did the same). Both arms added unrequested public surface in every
run.

Cost: 33% fewer tokens, 11% less money, 15% less wall time without the docs
and guide, but with a wide spread (one run at 5.2M, another at 9.7M). The
saving is real but smaller than the third experiment's 47%, and the two
no-guidance arms (6.2M±0.4M with comments stripped, 7.8M±2.3M with comments
kept) overlap within noise, so the docs and the guide account for most of
the third experiment's gap and the comments for little or none, which is
what the second experiment found directly. Results dir:
`results/keep-on-top-trunk-vs-nodocs`.
