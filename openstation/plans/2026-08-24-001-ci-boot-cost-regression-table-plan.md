---
title: "ci: Boot-cost regression table on every PR"
type: ci
status: draft
date: 2026-08-24
---

# ci: Boot-cost regression table on every PR

## Summary

Run `bin/boot-cost.mjs` in CI on every pull request and post a sticky comment comparing the PR's shell boot document against its merge base, in two configurations (the default wp-env plugin set, and the same instance with Gutenberg deactivated). One wp-env instance serves both revisions, flipped with `git checkout`, so the only variable is the code. Delivery follows the existing `pr-preview-build.yml` / `pr-preview-publish.yml` split so the measuring job keeps its read-only token and the commenting job never executes PR code; the artifact crosses that boundary as validated JSON that the privileged side re-renders, never as pre-baked markdown.

---

## Problem Frame

A boot-cost change is currently unverifiable at review time. `bin/boot-cost.mjs` (#667) makes the measurement possible but entirely manual: start an instance, measure, switch branches, measure, diff, and remember to flip `SCRIPT_DEBUG` and to check what else is enqueued. That is six steps and two branch switches per review, so in practice it will not happen, and its output never reaches the PR where reviewers actually are.

The cost of not having it is documented. #664 shipped with "3.6 MB raw / 1.1 MB gz" in its title. On the default wp-env instance the real boot saving was 65 KB raw / 15 KB gz, roughly 70x smaller, because Gutenberg's Dashboard page re-imports the same dependency closure the PR defers. Nobody could see that at review time, and the reviewer's own attempt to check it compared two environments running byte-identical plugin code and reported 344 vs 429 requests, 18.8 vs 6.5 MB transferred and 2 vs 3.1 minutes, none of which was code.

The failure mode is specific and repeatable: **deferral work is only as good as the set of enqueue roots it removes**, and a reviewer has no way to see the other roots. A number in CI, in two configurations, with the list of files that actually moved, turns that from tribal knowledge into a check.

---

## Requirements

- R1. On every PR to `trunk`, post a comment with boot-document cost for the PR head and its merge base, plus the delta.
- R2. Report at least two configurations: the default wp-env plugin set, and Gutenberg deactivated. A single figure is known to mislead by ~70x.
- R3. Measure both revisions against **one** running instance, so plugin set, theme, database and WordPress version are identical on both sides.
- R4. Report request count, raw bytes and gzipped bytes, and the list of asset files added to or removed from the document.
- R5. Numbers must be production-shaped: `SCRIPT_DEBUG` off, so figures are not inflated ~3x by unminified assets.
- R6. Update one comment in place across pushes rather than appending a new one.
- R7. The measuring job must run with a read-only token and must remain fork-safe.
- R8. The commenting job must never execute PR-authored code, and must not treat artifact bytes as trusted text.
- R9. Report-only. No status-check failure on a regression in the first phase.
- R10. Stay quiet when nothing moved beyond a noise threshold.

---

## Scope Boundaries

**In scope**

- Boot document only: the shell page at `/wp-admin/` after the portal redirect.
- Asset bytes and request counts, as printed by the server.
- Two plugin configurations, one WordPress version, one PHP version.
- A sticky PR comment and a JSON artifact.

**Out of scope**

- **Timings.** No `DOMContentLoaded`, `Load`, Lighthouse, or Core Web Vitals. This measures what the server emits, not what a browser does with it. A regression that is purely main-thread parse and execute cost will not be caught.
- **Gating.** No required status check, no merge block. Phase 3 at the earliest, and only once the noise floor is known.
- **Historical trend data.** No database, no time series, no dashboards. Absolute numbers are not stable across runs (see KD5), so only in-run deltas are meaningful.
- **First-open cost.** A deferral moves cost from boot to first open. Measuring the open path needs a browser driver and is a separate piece of work; see OQ3.
- **Per-window and chromeless documents.** `--path` supports them today; adding them to CI multiplies the matrix. Phase 2 candidate.

---

## Context & Research

**What already exists in this repo**, all of which this plan reuses rather than reinvents:

- `bin/boot-cost.mjs` and `npm run perf:boot-cost` (#667). Logs in, fetches one document, fetches every server-printed `<script src>` and `<link rel=stylesheet>` with `Accept-Encoding: identity`, gzips locally, groups by owner. `--out` writes per-asset JSON; `--diff` compares two JSON files and lists which files moved.
- `ci.yml` runs wp-env in CI twice already: the `php` job via `npm run env:start:tests`, and the `plugin-check` job which **generates its own `.wp-env.plugin-check.json` inside the workflow**. Generating a third config is an established pattern here.
- `ci.yml` declares `permissions: contents: read` with a comment stating it never writes comments, and its checkouts use `persist-credentials: false` specifically because later steps run PR-authored code. This constrains the design; see KD4.
- `pr-preview-build.yml` + `pr-preview-publish.yml` are already the fork-safe artifact handoff pattern, with an unusually explicit trust model: the build half runs on `pull_request` with `contents: read` and deliberately emits **no** PR metadata; the publish half runs on `workflow_run` with `pull-requests: write`, derives PR identity from the trusted event payload, and never checks out PR code. Its header warns that the build run "executes fork-controlled code that can write arbitrary artifact contents."
- `bin/setup-wp-env.sh` installs and activates Gutenberg on every fresh instance, via `wp plugin install` in `afterStart`.

**Measurements that motivate the design** (WP 7.1, Gutenberg 23.6.0, `SCRIPT_DEBUG` off, trunk `f4b8c5af` vs #664):

| Configuration | Requests | Raw | Gzipped |
|---|---|---|---|
| Gutenberg active | 136 → 134 | 7.09 → 7.06 MB | 2.15 → 2.14 MB |
| Gutenberg deactivated | 115 → 77 | 4.74 → 1.72 MB | 1.48 → 0.51 MB |

The same comparison with `SCRIPT_DEBUG` on gave a 1.91 MB gzipped saving instead of 0.97 MB, which is where the ~3x figure in R5 comes from.

**The mechanism worth encoding in the report.** With Gutenberg active, 39 files stay on the page because `dashboard-wp-admin-prerequisites` (a src-less aggregator registered in `gutenberg/build/pages/dashboard/page-wp-admin.php`, gated to `get_current_screen()->id === 'dashboard'`, which is the screen the shell boots on) lists the whole editor chain as dependencies. Six bundles from the deferred closure stay even with Gutenberg off, because other admin scripts need them: `a11y`, `date`, `deprecated`, `i18n`, `url`, `moment`. This is why R4 asks for the file list, not just totals: the totals say whether something moved, the file list says why.

**Known CI hazard.** Node 24.16.0 breaks `yauzl`, so zip plugin or theme sources in a `.wp-env` config make `wp-env start` exit mid-flight on cold CI runners. The generated perf config must install via `afterStart` wp-cli, never zip URLs.

---

## Key Technical Decisions

- **KD1. One instance, two revisions, flipped with `git checkout`.** The `.wp-env.json` mount serves the start directory live and `assets/js/` is committed, so checking out the merge-base SHA is sufficient to swap both PHP and bundles under a running site. Requires `fetch-depth: 0`. Rejected: two wp-env instances. Each keeps its own database, so they disagree about active plugins, theme and content, and that gap swamps the branch delta. This is the exact mistake that produced the misleading screenshots.

- **KD2. Compare against the merge base, not the trunk tip.** `git merge-base origin/trunk HEAD`. Otherwise unrelated trunk movement lands in the PR's delta.

- **KD3. Report a matrix, minimum two configurations.** Default plugin set answers "what does our test environment see"; Gutenberg deactivated answers "what does a stock install see". Both are needed because they differed by 70x on #664. Implemented as `wp plugin deactivate gutenberg` between measurement pairs on the same instance, so it is two extra measurements rather than two extra instances.

- **KD4. Two-workflow split, cloning `pr-preview-*`.** The measuring job stays on `pull_request` with `contents: read`; a `workflow_run` companion holds `pull-requests: write`. Rejected: adding `pull-requests: write` to `ci.yml`, which would hand a write-capable token to jobs that run PR-authored npm scripts. Rejected: `pull_request_target`, which is the same hazard with extra steps.

- **KD5. The artifact carries JSON, and the privileged side renders the table.** Every figure is coerced with `Number()` and rejected if non-finite; owner and path strings are escaped before they reach markdown. Rationale is written directly into `pr-preview-publish.yml`'s header: artifact bytes are fork-controlled. A pre-baked markdown table would let a fork post arbitrary content into PR comments, or simply fabricate a reassuring "no regressions" result. PR identity comes from the `workflow_run` payload, never from the artifact.

- **KD6. `SCRIPT_DEBUG` off via a generated `.wp-env.perf.json`.** Same technique as the `plugin-check` job. Note this also switches core to concatenated `load-scripts.php` bundles, so request counts change shape as well as size; that is fine because both sides of the comparison see it.

- **KD7. Sticky comment via a hidden marker.** `<!-- boot-cost-report -->` in the body; the publish job looks for it and edits in place, creating only if absent.

- **KD8. Report-only, with a noise threshold.** Nonces jitter the document by a few bytes per run. Gate the comment on a minimum delta (proposal: 5 KB gzipped or 2 requests in either configuration) and otherwise post or keep a one-line "no significant change" body.

---

## Open Questions

- **OQ1. Threshold values.** 5 KB gz / 2 requests is a guess. Needs a handful of no-op PRs measured to establish the real noise floor before the threshold is fixed.
- **OQ2. Pin Gutenberg, or track latest?** Latest catches upstream changes that erase our wins, which is exactly what happened with #664, and is the more useful signal. Pinning makes absolute numbers stable across runs. Proposal: track latest and report the resolved version in the comment, since only in-run deltas are claimed. Revisit if the comment becomes noisy from upstream churn.
- **OQ3. Is first-open cost worth measuring later?** A deferral moves cost rather than deleting it, so a boot-only report structurally flatters every deferral PR. Measuring the open path needs a browser driver in CI. Deliberately deferred, but it is the honest completion of this idea.
- **OQ4. Third configuration?** A "Gutenberg active, Dashboard enqueue unhooked" row would show what the win *would* be if the follow-up to #664 landed. Useful while that is open, probably noise afterwards.
- **OQ5. Where do the numbers live long term?** If trend data is ever wanted, the artifact is already the raw material, but nothing consumes it yet.

---

## High-Level Technical Design

Two workflows and one generated config.

```
boot-cost-measure.yml          (on: pull_request, permissions: contents: read)
  checkout fetch-depth: 0, persist-credentials: false
  npm ci
  write .wp-env.perf.json  { SCRIPT_DEBUG: false, mount ".", afterStart install }
  wp-env start
  BASE=$(git merge-base origin/trunk HEAD)
  for rev in $BASE $HEAD:
    for config in default gutenberg-off:
      git checkout $rev
      npm run perf:boot-cost -- --base <port> --label "$rev/$config" --out out/$rev-$config.json
  upload-artifact: boot-cost  (JSON only, no PR metadata)

boot-cost-report.yml           (on: workflow_run, permissions: pull-requests: write, actions: read)
  download artifact from the triggering run
  validate: parse JSON, Number() every figure, reject non-finite, escape strings
  render markdown table
  find comment by <!-- boot-cost-report --> marker; edit or create
```

**JSON contract.** `bin/boot-cost.mjs --out` already emits `{ label, base, requested, finalUrl, htmlBytes, htmlGzBytes, inlineJsBytes, inlineCssBytes, assets: [{ kind, url, owner, raw, gz }] }`. The report job needs no new fields; it derives totals, per-owner grouping and the added/removed file lists itself, which is also what makes validation straightforward: it only ever reads numbers and paths.

**Comment shape.**

```
<!-- boot-cost-report -->
### Boot cost

|                  | base `9d6880e1` | this PR | Δ |
| Gutenberg active |                 |         |   |
| requests         | 136             | 134     | -2 |
| assets gzipped   | 2.15 MB         | 2.14 MB | -0.5% |
| Gutenberg off    |                 |         |   |
| requests         | 115             | 77      | -38 |
| assets gzipped   | 1.48 MB         | 0.51 MB | -66% |

<details>39 files removed …</details>

WP 7.1 · Gutenberg 23.6.0 · SCRIPT_DEBUG off · boot document only, not timings
```

---

## Implementation Units

- **U1. `--format=json` summary mode for `bin/boot-cost.mjs`.** Optional: emit a compact totals-and-groups object alongside the per-asset detail, so the report job does less arithmetic. Acceptance: `--diff a.json b.json --format=json` prints a machine-readable delta; existing human output unchanged.

- **U2. Generated `.wp-env.perf.json`.** `SCRIPT_DEBUG: false`, mount `.`, Gutenberg installed via `afterStart` wp-cli, distinct port. No zip sources (see the yauzl hazard). Acceptance: `wp-env start` succeeds on a cold CI runner; `wp eval 'var_dump(SCRIPT_DEBUG);'` prints `false`.

- **U3. `boot-cost-measure.yml`.** The four-measurement loop over two revisions and two configurations against one instance. Acceptance: artifact contains four JSON files; job token is `contents: read`; passes on a fork PR.

- **U4. Validation and render script.** Parses artifact JSON, coerces and bounds-checks every number, escapes every string that reaches markdown, renders the table. Lives in `bin/` so it is testable outside CI. Acceptance: a Vitest case feeding it hostile input (markdown injection in an `owner`, `NaN` and `Infinity` figures, missing keys) produces either a safe table or a clean refusal, never raw passthrough.

- **U5. `boot-cost-report.yml`.** `workflow_run` companion, sticky comment by marker, PR identity from the event payload only. Acceptance: two consecutive pushes produce one comment, edited twice.

- **U6. Threshold logic.** Suppress or collapse the comment when both configurations move less than the threshold. Acceptance: a docs-only PR produces no table.

- **U7. `docs/DEVELOPMENT.md`.** Extend the existing `## Measuring boot cost` section with a short "in CI" subsection: what the comment means, what it does not measure, how to reproduce a surprising number locally.

---

## System-Wide Impact

- **CI time.** One additional wp-env start (~60 to 90s on a cold runner) plus four measurements of a few seconds each. Runs in parallel with existing jobs, so wall clock grows by roughly the wp-env start. The four measurements share one instance, which is the whole point of KD1 and also what keeps this cheap.
- **Token and permission surface.** One new workflow gains `pull-requests: write`. It never checks out PR code, matching `pr-preview-publish.yml` exactly.
- **Artifact storage.** Four JSON files per PR run, a few hundred KB before compression. Set a short retention.
- **Maintenance.** The report is only as honest as its configuration list. If a future WordPress ships the Dashboard redesign into core, the "Gutenberg off" column stops being the stock case and the matrix needs revisiting. That is a feature of the design, not a bug: the row will visibly collapse.

---

## Risk Analysis & Mitigation

- **Markdown injection from a fork-controlled artifact.** Highest-severity item. Mitigated by KD5: JSON only, numbers coerced, strings escaped, table rendered privileged-side, PR identity from the event payload. U4's hostile-input test is the guard.
- **False confidence.** A green "no regression" comment invites the belief that performance was checked, when only server-emitted bytes were. Mitigated by printing the limitation in the comment footer on every run, not just in the docs.
- **Structural flattery of deferral PRs.** Boot-only measurement always makes a deferral look good, even one that moves more work to first open than it removes from boot. Mitigated only partially by OQ3; until then the footer must say "boot document only".
- **Noise fatigue.** A table on every PR, mostly reading zero, trains reviewers to ignore it. Mitigated by U6's threshold, and by OQ1 measuring the real noise floor before fixing it.
- **Upstream drift.** Gutenberg installs latest at job time, so a delta can move because upstream changed rather than because the PR did. Mitigated by reporting the resolved version in the comment; OQ2 tracks whether to pin.
- **wp-env flakiness on cold runners.** The known yauzl failure mode exits mid-flight rather than erroring loudly. Mitigated by U2 avoiding zip sources, and by asserting the site responds before measuring rather than trusting `wp-env start`'s exit code.
- **Merge-base checkout leaves the tree dirty.** A failed checkout mid-loop would measure a mixture. Mitigated by asserting a clean tree and the expected `HEAD` SHA before each measurement.

---

## Phased Delivery

- **P1. Report only.** U1 through U5, default plus Gutenberg-off configurations, comment on every PR. Goal is to learn the noise floor and whether anyone reads it.
- **P2. Quiet and broaden.** U6's threshold using real P1 data, then optionally add the chromeless document as a third measurement pair, and OQ4's third configuration while the #664 follow-up is open.
- **P3. Consider gating, and first-open cost.** Only after P1 and P2 have shown the numbers are stable enough to block a merge on, and only with an explicit override label. OQ3's browser-driven open-path measurement is a separate plan if it happens at all.

---

## Documentation Plan

- Extend `## Measuring boot cost` in `docs/DEVELOPMENT.md` (U7) with the CI subsection: reading the comment, its stated limits, reproducing locally.
- No public-contract docs change. This is internal tooling; nothing in `docs/` that plugin authors depend on moves.
- If P3 ever adds a gate, that needs its own note explaining the override path.

---

## Sources & References

- `bin/boot-cost.mjs`, `npm run perf:boot-cost`, `docs/DEVELOPMENT.md` section `## Measuring boot cost` (#667).
- `.github/workflows/pr-preview-build.yml` and `.github/workflows/pr-preview-publish.yml` for the fork-safe artifact handoff and its trust model.
- `.github/workflows/ci.yml`, the `plugin-check` job, for generating a wp-env config inside a workflow.
- `bin/setup-wp-env.sh` for the Gutenberg activation that motivates KD3.
- PR #664 for the worked example: title claim 3.6 MB raw / 1.1 MB gz, measured 65 KB raw / 15 KB gz on a default instance.
- `gutenberg/build/pages/dashboard/page-wp-admin.php` for the competing enqueue root.
