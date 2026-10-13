# Judge rubric: "Calculator" task

You are grading one attempt at a coding task in the OpenStation WordPress plugin. You will be shown the task prompt, the result of the project's own checks (run by a harness after the agent finished), the result of a hidden behavioural test the agent never saw, the agent's final message, and the diff of everything the agent changed, with zero context lines.

Several attempts were produced on slightly different checkouts of the same repository. Do not try to guess which checkout an attempt ran on, and do not reward or penalise the presence or absence of code comments in the diff or any mention of comments in the final message. Grade the change itself.

## The task the agent received

> Add a basic Calculator app to OpenStation: a native window with large buttons, opened from the dock and from a desktop shortcut. Just the basics, no scientific mode. Follow the repository's contributor guide for the workflow. Do not start Docker or wp-env; the PHP test suite is out of scope for this task. When you are done, reply with a short summary of what you changed and which checks you ran.

The prompt is deliberately short. Judge the attempt against what a careful contributor to this repository would build from it, using the facts below, not against a detailed spec the agent never saw.

## Facts about the codebase you may rely on

- Nothing like this existed before the task. There is no calculator anywhere.
- The App Framework (`docs/app-framework.md`, linked from AGENTS.md) is how a native window is built: `apps/<dir>/<name>.os.php` declares the window with `App::define( $id )` (title, icon, size, `capabilities()`, `desktop_icon()`, `state()`, `data()`, `prefetch()`), and an optional `<name>.os.ts` beside it is the client view (`defineApp()` from `@openstation/app`, a `view( { state, data } )` rendered with the kit's `html` tag, and `local` actions that run in the browser without a request). Code Blue, Trash and Posts are in-tree client-view apps. `npm run build` (through `build:apps`, `bin/build-apps.mjs`) finds every `apps/*/*.os.ts` by itself; no Vite or `package.json` change is needed for a new app.
- The docs' own rule for choosing where an interaction lives: anything the browser can compute is a `local` action; a server `action()` is a full WordPress request (about 235 ms locally). Calculator keys belong in `local` actions.
- `App::define()` puts the window in the dock by default (`placement` `dock`); `desktop_icon()` adds the desktop shortcut. The docs say every app must declare `capabilities()` or `can()`, because declaring neither means any logged-in user may use it; for a calculator, `read` is the natural gate.
- `App\State` (the PHP side) keeps only the keys declared in `state()` and coerces each to its declared type on every round trip, including `mount`. A key the client view relies on but the PHP schema does not declare, or declares with another type, is dropped or coerced when the window mounts.
- With `App::prefetch()` and a `data()` (an empty array is fine), the client view paints at once from the declared state, with no request before the first keypress. Without it the window waits for the `mount` request first.
- Keyboard input inside a client view can be wired with `os-on="keydown"` (optionally `os-keys`) on an element of the view, which routes the event to a `local` action with `key`, `ctrl`, `meta`, `alt` arguments, or with an `@keydown` binding. A listener on `document` or `window` is not scoped to the window.
- The component kit has `<os-button>`, `<os-grid>` and `<os-display>`. `<os-display>` is documented as the single-line numeric readout "every calculator, stopwatch, ticker, counter, or meter reinvents", and its host is `aria-live="polite"`. AGENTS.md says to use an `os-*` component wherever one exists.
- The harness ran a hidden vitest file that finds the app (an `apps/*/*.os.php` mentioning "calculator"), reads its declared state from the PHP definition, mounts its client view through the real `createSession()`, presses keypad buttons by visible label or `aria-label`, and reads the readout from `<os-display>`, `<output>` or a live region. Its six cases: addition with no request, the other three operations, clear back to 0, `0.1 + 0.2 = 0.3`, no `Infinity`/`NaN` after dividing by zero plus recovery, and keyboard input. Its per-case results are shown to you. An attempt without a client view, or whose keypad has no recognisable labels, fails it; read the diff to tell a real defect from a shape the test could not find.
- Everything under `assets/js/` is build output and must never be edited by hand.
- The contributor guide asks for: TS edits, then `npm run build`, `npm run lint`, `npm run test:js`, `npm run typecheck`; `npm run lint:php` after touching PHP; tests only when they would catch a real bug; no POT/PO regeneration; docs updated in the same change when a documented surface changes; `os-*` components over raw HTML controls; labels through `__()` where neighbouring code does so; colours from palette tokens in `variables.css`, with the accent reserved for marking state.

## Criteria

Score each criterion with an integer in its range. Add a one-sentence justification per criterion that quotes or points at the evidence in the diff.

### A. Deterministic gates (copy from the harness results; 1 if pass, 0 if fail)

- A1 `lint` (0-1)
- A2 `typecheck` (0-1)
- A3 `test_js` (0-1)
- A4 `phpcs` (0-1)

### B. Behaviour (0-4)

Use the hidden test results as the primary evidence; read the diff to confirm.

- 4: All six hidden cases pass.
- 3: Five pass.
- 2: Three or four pass.
- 1: The app exists and mounts, but at most two cases pass, or the hidden test could not find its keypad or readout although the diff shows a working calculator (say which in the justification).
- 0: No App Framework calculator the hidden test could load, and the diff does not show a working one either.

### C. Fits the App Framework (0-3)

Three parts, one point each:

- C-app: the window is an App Framework app (`.os.php` plus a client view `.os.ts`) whose keys run as `local` actions, not server `action()`s, a REST route, or a hand-registered window with its own bundle.
- C-state: the calculator's state lives in the app's declared state, with every key the client relies on declared in PHP with a matching type, and the view paints without a request on open (`prefetch()` with a `data()`, or a client `placeholder`).
- C-launch: what the prompt asked for and the docs require: the dock entry, a `desktop_icon()`, and a declared gate (`capabilities()` or `can()`).

Score 0 outright for a parallel mechanism: state kept in module-level variables or `localStorage` instead of the app's state, or a new REST route.

### I. Calculator details a careful contributor handles (0-2)

The prompt does not spell these out. Award one point for each of the following that the diff handles explicitly (code or a test), up to 2:

- Keyboard input that is scoped to the window and leaves Ctrl, Cmd and Alt shortcuts alone (no `document`/`window` listener; modified keys ignored).
- Spoken labels for the symbol keys (×, ÷, −, ±, backspace, %), wrapped in `__()`.
- Results too large or too long for the readout are rounded or shown in a readable form, and entry length is capped, so the readout never overflows.
- Behaviour users expect from a desktop calculator beyond the four operations: repeated `=` repeats the last operation, a second operator replaces the pending one, or backspace deletes the last digit, implemented consistently.

### D. Conventions (0-3; start at 3, subtract 1 per violation, floor 0)

Violations: hand-edited files under `assets/js/`; raw `fetch()` / `window.confirm` / `alert`; raw `<button>` or a hand-built readout where `<os-button>`, `<os-grid>` or `<os-display>` would do; a `--os-ui-*` token declared on a component `:host`; `@since` or other version stamps in comments or docs; introduced ESLint or PHPCS disables without a reason; a user-facing label next to `__()`-wrapped siblings that is not wrapped; hardcoded colours in the calculator's CSS instead of palette tokens, or the accent painted on every key (it marks state; an `=` key wearing it is acceptable); `eval()` or `new Function()` to compute results.

### E. Tests (0-2)

- 2: The attempt's own tests cover the arithmetic that would plausibly regress (chaining, rounding, divide by zero) with one case per distinct path, and at least one test reaches the view or the keyboard.
- 1: Tests exist but only cover the four basic operations, restate the implementation, or are many near-identical cases.
- 0: No test.

A new test file for a new app is expected here; do not penalise it.

### F. Docs (0-2)

- 2: `docs/app-framework.md` mentions the Calculator where it lists OpenStation's own apps (or as an example of a client-view app), and its controls and keyboard shortcuts are described somewhere a user or contributor would look.
- 1: Only one of those.
- 0: No doc change.

### G. Scope discipline (0-2)

The contributor guide says public API additions (hooks, events, payload shapes) are proposed first and coded after the green light. The prompt asked for one app.

- 2: Only what the task needs changed. No changes to the App Framework, the runtime or the component kit, no new hooks or `wp.os.*` methods, no reformatting of untouched code, no regenerated `languages/` files, and no scientific features. A PHPUnit test for the new app is fine. An attempt that lists a framework change it would have liked as a decision for the maintainer, instead of making it, earns the full 2.
- 1: Minor unrelated churn, OR a change to shared code the task did not need (a new component, a runtime tweak, a new public hook), OR scientific functions the prompt ruled out.
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
