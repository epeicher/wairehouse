# Judge rubric: "Keep on top" task

You are grading one attempt at a coding task in the OpenStation WordPress plugin. You will be shown the task prompt, the result of the project's own checks (run by a harness after the agent finished), the result of a hidden behavioural test the agent never saw, the agent's final message, and the diff of everything the agent changed, with zero context lines.

Several attempts were produced on slightly different checkouts of the same repository. Do not try to guess which checkout an attempt ran on, and do not reward or penalise the presence or absence of code comments in the diff or any mention of comments in the final message. Grade the change itself.

## The task the agent received

> Add a "Keep on top" option to desktop windows. It is toggled from a pin button in the window's title bar, next to the existing window controls, and while it is on the window stays above every other window on the desktop, even when another window is focused or opened. Several windows can be kept on top at once; among themselves they stack in normal focus order. Turning it off restores normal stacking. The state is part of the window's session state and survives a page reload. Expose it programmatically as `windowManager.setAlwaysOnTop( windowId, enabled )` and a readable `alwaysOnTop` property on the window. Follow the repository's contributor guide for the workflow. Do not start Docker or wp-env; the PHP test suite is out of scope for this task.

## Facts about the codebase you may rely on

- Nothing like this existed before the task. There is no `alwaysOnTop`, pin button or stacking flag anywhere.
- Stacking: `WindowManager` in `src/window-manager/index.ts` keeps the z-order as the array `_stack` (last element is topmost). `focus()` moves the window to the end, calls `enforceOwnershipOrder()`, then writes `BASE_Z_INDEX + index` to every window with `setZIndex()` (inline `style.zIndex`) and marks the last one focused. `raise()` does the same without focus. `enforceOwnershipOrder()` is the existing precedent for a stacking rule: it reorders `_stack` so a child window is never below its owner. Open windows get their z-index from the same restack. Inline `style.zIndex` beats any stylesheet rule, so a CSS-only approach cannot work.
- Title bar: the built-in minimize / maximize / fullscreen / close buttons are registered in `src/window-chrome/controls/built-ins.ts` through `registerWindowControl()` (`placement: 'controls'`, `order` sorts them, `match`, `onClick`, labels wrapped in `__()`). `registerTitleBarButton()` in `src/title-bar-buttons/registry.ts` is the other sanctioned surface (`placement: 'right'` lands before the controls); `src/mio/window-toggle.ts` is an in-tree toggle button built on it with `aria-pressed`. Either registry is an acceptable way to add the pin; hand-built DOM in the window's chrome is not.
- Session, JS side: `WindowManager.snapshot()` builds a `SessionWindow` per persistable window with an explicit field list; `restoreSession()` in `src/boot/session.ts` maps a `SessionWindow` back into an `openNew()` config (iframe windows) or a restore seed (native windows, through `seedWindowRestoreState()` and the `NativeWindowRestoreState` type in `src/native-windows.ts`). `gridSpan` is the in-tree precedent for a per-window flag that travels through all of those. Types live in `src/types.ts` (`WindowConfig`, `SessionWindow`).
- Session, PHP side: the session is saved to user meta through `openstation_sanitize_session()` in `includes/session.php`, which rebuilds each window entry from an explicit key list (`gridSpan`, `unplaced`, `params`, `externalTabs` are each added by name). A key the sanitizer does not know is dropped on save. So a flag added only in TypeScript round-trips inside one page but does NOT survive a real reload; meeting the prompt's reload requirement needs a line in that sanitizer. The task said the PHP *test suite* is out of scope, not PHP changes.
- The harness ran a hidden vitest file that exercises only the surface the prompt fixed: `setAlwaysOnTop()`, `alwaysOnTop`, inline z-index, and `snapshot()` → `restoreSession()`. It cannot see the PHP sanitizer. Its per-case results are shown to you.
- Everything under `assets/js/` is build output and must never be edited by hand.
- The contributor guide asks for: TS edits under `src/`, then `npm run build`, `npm run lint`, `npm run test:js`, `npm run typecheck`; tests only when they would catch a real bug, extending an existing test file over creating a new one; no POT/PO regeneration; docs updated in the same change when a documented surface changes; `os-*` components over raw HTML controls; labels through `__()` where neighbouring code does so.

## Criteria

Score each criterion with an integer in its range. Add a one-sentence justification per criterion that quotes or points at the evidence in the diff.

### A. Deterministic gates (copy from the harness results; 1 if pass, 0 if fail)

- A1 `lint` (0-1)
- A2 `typecheck` (0-1)
- A3 `test_js` (0-1)
- A4 `phpcs` (0-1)

### B. Behaviour (0-4)

Use the hidden test results as the primary evidence; read the diff to confirm.

- 4: All five hidden cases pass AND the PHP sanitizer keeps the flag, so the reload requirement is really met.
- 3: All five hidden cases pass but the flag is dropped server-side (no change in `includes/session.php`), so it survives a snapshot but not a real reload.
- 2: Stacking cases pass (pinned stays above on focus and on open, unpin restores, several pinned order by focus) but the session round-trip fails or was not implemented.
- 1: The API exists and a pinned window is placed above once, but it drops back on the next focus or open (the rule is not applied on every restack), or multiple pinned windows are mishandled.
- 0: `setAlwaysOnTop` missing, or the hidden file could not run against this change.

### C. Fits the existing mechanisms (0-3)

Three parts, one point each:

- C-stack: the stacking rule is applied where restacks already happen (inside or next to `enforceOwnershipOrder()`, or a single pass that `focus()`, `raise()` and open all run), reading `_stack` rather than keeping separate z-index arithmetic.
- C-pin: the pin is a `registerWindowControl` or `registerTitleBarButton` registration, not DOM built by hand in the window chrome.
- C-session: the flag follows the whole `gridSpan` path: `snapshot()`, the iframe branch of `restoreSession()`, the native branch through the restore seed (`NativeWindowRestoreState` and `seedWindowRestoreState()`), and the types. A native window that is pinned by a separate call after it opens, instead of through the seed, does not earn this point.

Score 0 outright for a parallel mechanism: a separate storage for the flag (localStorage, a new user meta, a new REST route), or its own stack kept beside `_stack`.

### I. Stacking rule edge cases (0-2)

The prompt does not spell these out, but the window manager already has rules a stacking change must respect. Award one point for each of the following that the diff handles explicitly (code or a test), up to 2:

- Ownership: a child window of a pinned owner is never drawn below that owner (the existing `enforceOwnershipOrder()` guarantee survives the new rule, by walking the owner chain or ordering children with their owner).
- Fullscreen: a fullscreen window still covers everything, pinned windows included.
- Minimized: a pinned window that is minimized does not take a slot above the others, and gets it back when restored.
- Idempotence: setting the value a window already has changes nothing and announces nothing; an unknown id is a no-op.

### D. Conventions (0-3; start at 3, subtract 1 per violation, floor 0)

Violations: hand-edited files under `assets/js/`; raw `fetch()` / `window.confirm` / `alert`; raw `<button>` where an `<os-window-button>` or a registry would do; a `--os-ui-*` token declared on a component `:host`; `@since` or other version stamps in comments or docs; introduced ESLint disables without a reason; a user-facing label next to `__()`-wrapped siblings that is not wrapped; the pin's "on" state painted with a hardcoded colour instead of a palette token (the accent is allowed, it marks state).

### E. Tests (0-2)

- 2: A test covers the stacking rule across a focus (the thing that would plausibly regress), or the session round-trip, added to an existing window-manager or session test file.
- 1: A test exists but only restates the implementation (asserts the method was called, or checks a class name), or a brand-new file holds a couple of trivial assertions.
- 0: No test.

### F. Docs (0-2)

- 2: `docs/javascript-reference.md` lists `setAlwaysOnTop()` in the `windowManager` method block and describes the `alwaysOnTop` property or the pin, and the session or window-config shape mentions the new field where the doc already lists fields.
- 1: Only one of those.
- 0: No doc change.

### G. Scope discipline (0-2)

The contributor guide says public API additions (hooks, events, config options) are proposed first and coded after the green light. The prompt fixed the public surface: one method, one property, one button, one session field.

- 2: Only what the task needs changed, and no public surface beyond what the prompt fixed. No reformatting of untouched code, no regenerated `languages/` files, no unrelated refactors. Reusing an existing event (for instance `os-window-changed` with a new reason) is fine. An attempt that explicitly lists a possible new hook or event as a decision for the maintainer, instead of adding it, earns the full 2.
- 1: Minor unrelated churn, OR new public surface the prompt did not ask for: a new CustomEvent or hook constant, a new `WindowConfig` open-time option, a new documented CSS class, a new icon key documented as public.
- 0: Large unrelated changes, generated files committed, or both of the above.

### H. Workflow evidence (0-1)

- 1: The final message says the agent ran build, lint, tests and typecheck, and that claim is consistent with the gate results.
- 0: No such evidence, or a claim contradicted by a failing gate.

## Output

Reply with ONLY a JSON object, no prose before or after, in this exact shape:

{
  "scores": { "A1": 0, "A2": 0, "A3": 0, "A4": 0, "B": 0, "C": 0, "D": 0, "E": 0, "F": 0, "G": 0, "H": 0, "I": 0 },
  "total": 0,
  "max": 23,
  "justifications": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "...", "F": "...", "G": "...", "H": "...", "I": "..." },
  "notable": "one or two sentences on the single most important strength or weakness"
}

`total` is the plain sum of all scores (max 23).
