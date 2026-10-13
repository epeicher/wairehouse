# Judge rubric: "Tile all windows" task

You are grading one attempt at a coding task in the OpenStation WordPress plugin. You will be shown the task prompt, the result of the project's own checks (run by a harness after the agent finished), the agent's final message, and the diff of everything the agent changed, with zero context lines.

Several attempts were produced on slightly different checkouts of the same repository. Do not try to guess which checkout an attempt ran on, and do not reward or penalise the presence or absence of code comments in the diff or any mention of comments in the final message. Grade the change itself.

## The task the agent received

> Add a "Tile all windows" entry to the dock's System menu (the menu whose first row is "OpenStation Preferences"), placed right after "Fullscreen". Choosing it arranges every open window on the current desktop so that together they use the available space: two windows side by side (half/half), three windows in thirds (1/3-1/3-1/3), four windows in a 2x2 square, and so on for more windows. Follow the repository's contributor guide for the workflow.

## Facts about the codebase you may rely on

- `src/window-manager/arrange.ts` already exports `tile( mgr )`, which lays every window on the active desktop out in a grid over the work area. `windowManager.tile()` is a documented public method. It had no UI of its own before this task; `docs/javascript-reference.md` says so explicitly.
- `tile()` picks the grid with `pickGridDimensions()` in `src/window-manager/geometry.ts`, which scores grids by cell aspect ratio. On a typical landscape work area it returns 2x1 for two windows, 2x2 for THREE windows (one cell empty), and 2x2 for four. So the "three in thirds" requirement is not met by the existing picker as-is; it needs either a change to the picker, a rule in `tile()`, or the `os.arrange.tile.dimensions` filter.
- The System menu rows are built in `src/desktop.ts` in the `systemTile` definition, as `SubmenuItem` objects (`title`, `url`, `onSelect`, optional `windowId`). The window manager instance there is `manager`.
- Everything under `assets/js/` is build output and must never be edited by hand.
- The contributor guide asks for: TS edits under `src/`, then `npm run build`, `npm run lint`, `npm run test:js`, `npm run typecheck`; tests only when they would catch a real bug, extending an existing test file over creating a new one; no POT/PO regeneration; docs updated in the same change when a documented surface changes.

## Criteria

Score each criterion with an integer in its range. Add a one-sentence justification per criterion that quotes or points at the evidence in the diff.

### A. Deterministic gates (copy from the harness results; 1 if pass, 0 if fail)

- A1 `lint` (0-1)
- A2 `typecheck` (0-1)
- A3 `test_js` (0-1)
- A4 `phpcs` (0-1)

### B. Functional completeness (0-3)

- 3: A "Tile all windows" row exists in the System submenu right after "Fullscreen", selecting it tiles the windows, and the three-window case yields three columns on a landscape area (by changing the picker, special-casing in `tile()`, or applying the dimensions filter). Two and four windows behave as asked.
- 2: Row exists and tiles, but the three-window case is not addressed (it will still produce 2x2).
- 1: Row exists but the wiring is wrong, or the layout is implemented but not reachable from the menu.
- 0: Neither.

### C. Reuse over reinvention (0-2)

- 2: Calls the existing `tile()` / `windowManager.tile()` path (possibly adjusting the grid rule).
- 1: Reimplements part of the layout but still uses the work-area API and the window manager's stack.
- 0: Writes a new tiling algorithm from scratch, or positions windows by reading `#os-area` / `clientWidth` / `getBoundingClientRect` directly.

### D. Conventions (0-3; start at 3, subtract 1 per violation, floor 0)

Violations: hand-edited files under `assets/js/`; raw `fetch()` / `window.confirm` / `alert`; a `--os-ui-*` token declared on a component `:host`; `@since` or other version stamps in comments or docs; introduced ESLint disables without a reason. Note: the existing System rows in `desktop.ts` are plain strings, so a label that is NOT wrapped for i18n is not a violation here.

### E. Tests (0-2)

- 2: A test covers the behaviour that could plausibly regress (the three-window grid rule, or the row being present), added to an existing test file.
- 1: A test exists but only restates the implementation, or a new test file was created for a couple of trivial assertions. Also score 1 when no grid-rule change was made, only a menu row was added, and no test was written, since a test adds little there.
- 0: No test, AND a grid-rule change was made that existing tests did not cover.

### F. Docs (0-2)

- 2: `docs/javascript-reference.md` no longer claims `tile()` has no UI, and any changed hook or filter behaviour is reflected.
- 1: Some doc was updated but the "no UI of their own" claim still stands, or vice versa.
- 0: No doc change.

### G. Scope discipline (0-2)

- 2: Only files needed for the task changed. No reformatting of untouched code, no regenerated `languages/` files, no unrelated refactors.
- 1: Minor unrelated churn.
- 0: Large unrelated changes, or generated files committed.

### H. Workflow evidence (0-1)

- 1: The final message says the agent ran build, lint, tests and typecheck, and that claim is consistent with the gate results.
- 0: No such evidence, or a claim contradicted by a failing gate.

## Output

Reply with ONLY a JSON object, no prose before or after, in this exact shape:

{
  "scores": { "A1": 0, "A2": 0, "A3": 0, "A4": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0, "G": 0, "H": 0 },
  "total": 0,
  "max": 19,
  "justifications": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "...", "F": "...", "G": "...", "H": "..." },
  "notable": "one or two sentences on the single most important strength or weakness"
}

`total` is the plain sum of all scores (max 19).
