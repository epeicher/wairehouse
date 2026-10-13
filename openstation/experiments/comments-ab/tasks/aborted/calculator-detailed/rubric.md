# Judge rubric: "Calculator" task

You are grading one attempt at a coding task in the OpenStation WordPress plugin. You will be shown the task prompt, the result of the project's own checks (run by a harness after the agent finished), the result of a hidden behavioural test the agent never saw, the agent's final message, and the diff of everything the agent changed, with zero context lines.

Several attempts were produced on slightly different checkouts of the same repository. Do not try to guess which checkout an attempt ran on, and do not reward or penalise the presence or absence of code comments in the diff or any mention of comments in the final message. Grade the change itself.

## The task the agent received

> Add a basic Calculator app to OpenStation. It opens as a native window from the dock and from a desktop shortcut, and any signed-in user who can read the site can use it. It is a basic calculator, not a scientific one: a large four-column keypad with the digits, a decimal point, + − × ÷, =, %, ± (change sign), backspace and AC (clear), above a readout that screen readers announce. All arithmetic runs in the browser; pressing a key never sends a request.
>
> How it behaves:
>
> - Operations run left to right as they are entered: `2 + 3 × 4 =` gives 20. Choosing another operator before typing the next number replaces the pending one.
> - Pressing = again repeats the last operation: `5 + 2 = =` gives 9. Typing a digit after = starts a new calculation.
> - After + or −, % takes that percentage of the first number: `200 + 10 % =` gives 220. Otherwise % divides the number on the readout by 100: `50 %` gives 0.5, `200 × 10 % =` gives 20.
> - Results hide binary rounding noise: `0.1 + 0.2 =` gives 0.3. A second decimal point in the same number is ignored. Entry stops at 12 digits, and results are rounded to 12 significant digits.
> - Dividing by zero shows `Error`; typing a digit or pressing AC starts again.
> - The readout shows plain numbers: a leading `-` for negatives, `.` as the decimal point, no thousands separators.
> - While the calculator has focus, the keyboard works too: digits, `+ - * / . % =`, Enter for =, Backspace, and Delete or Escape for AC. Keys typed in other windows never reach it, and shortcuts with Ctrl, Cmd or Alt keep their normal behaviour.
>
> Keep the arithmetic in a pure module, `apps/calculator/parts/engine.ts`, exporting `initialState()` and `pressKey( state, key )`. `pressKey` returns a new state and leaves the one it was given untouched; `key` is one of `'0'`–`'9'`, `'.'`, `'+'`, `'-'`, `'*'`, `'/'`, `'='`, `'%'`, `'sign'`, `'backspace'`, `'clear'`; and `state.display` is exactly what the readout shows. The calculator window's state is that same state object.
>
> Follow the repository's contributor guide for the workflow. Do not start Docker or wp-env; the PHP test suite is out of scope for this task. When you are done, reply with a short summary of what you changed and which checks you ran.

## Facts about the codebase you may rely on

- Nothing like this existed before the task. There is no calculator anywhere.
- The App Framework (`docs/app-framework.md`) is how a native window is built: `apps/<dir>/<name>.os.php` declares the window with `App::define( $id )` (title, icon, size, `capabilities()`, `desktop_icon()`, `state()`, `data()`, `prefetch()`), and an optional `<name>.os.ts` beside it is the client view (`defineApp()` from `@openstation/app`, a `view( { state, data } )` rendered with the kit's `html` tag, and `local` actions that run in the browser without a request). Code Blue, Trash and Posts are in-tree client-view apps. `npm run build` (through `build:apps`, `bin/build-apps.mjs`) finds every `apps/*/*.os.ts` by itself; no Vite or `package.json` change is needed for a new app.
- `App::define()` puts the window in the dock by default (`placement` `dock`). `desktop_icon()` adds the desktop shortcut. `capabilities( 'read' )` is the gate for "any signed-in user who can read the site"; the docs say every app must declare `capabilities()` or `can()`, because declaring neither means any logged-in user. `admin( 'any' )` also shows it in network admin; it is optional here.
- `App\State` (the PHP side) keeps only the keys declared in `state()` and coerces each to its declared type, on every round trip (including `mount`). A key the engine's state carries but the PHP schema does not declare, or declares with another type, is dropped or coerced when the window mounts, so the PHP `state()` must match `initialState()` key for key and type for type.
- With `App::prefetch()` and a `data()` (an empty array is fine), the client view paints at once from the declared state, with no request before the first keypress. Without it the window waits for the `mount` request first.
- Keyboard input inside a client view can be wired with `os-on="keydown"` (optionally `os-keys`) on an element of the view, which routes the event to a `local` action with `key`, `ctrl`, `meta`, `alt` arguments, or with an `@keydown` binding. A listener on `document` or `window` is not scoped to the window.
- The component kit has `<os-button>`, `<os-grid>` and `<os-display>`. `<os-display>` is documented as the single-line numeric readout "every calculator, stopwatch, ticker, counter, or meter reinvents", and its host is `aria-live="polite"`. AGENTS.md says to use an `os-*` component wherever one exists.
- The harness ran a hidden vitest file that exercises only the surface the prompt fixed: the engine (`initialState()`, `pressKey()`, `state.display`), and the client view mounted through the real `createSession()` with `initialState()` as its state, driven by keyboard events and by clicking the `7` button. Its per-case results are shown to you.
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

Use the hidden test results as the primary evidence; read the diff to confirm. The hidden file has 13 cases: 9 on the engine, 4 on the mounted window.

- 4: All 13 hidden cases pass.
- 3: One or two cases fail, and the diff shows the failure is an edge of the arithmetic rules (a rounding or percentage corner) rather than missing wiring.
- 2: The engine cases mostly pass (at most two failures), but the window cases show the keyboard or the keypad is not wired to the engine through the app's state, or a key sends a request.
- 1: The engine exists with the prescribed exports, but several of the stated rules are wrong (left-to-right chaining, repeated equals, percent, Error recovery, the 12-digit limit), or `pressKey` mutates its input.
- 0: `apps/calculator/parts/engine.ts` is missing or does not export the prescribed functions, or the hidden file could not run against this change.

### C. Fits the App Framework (0-3)

Three parts, one point each:

- C-app: the window is an App Framework app (`apps/calculator/calculator.os.php` plus a client view `calculator.os.ts`) with `capabilities( 'read' )` (or an equivalent `can()`), a `desktop_icon()`, and the arithmetic in `local` actions, not server `action()`s and not a REST route.
- C-state: the PHP `state()` declares every key of `initialState()` with matching types, so a `mount` round trip does not drop or coerce the engine's state; and the view paints without a request (`prefetch()` with a `data()`, or a client `placeholder`).
- C-keys: keyboard input is scoped to the window (an `os-on="keydown"` or `@keydown` on the view, or a listener on the mount root), ignores Ctrl, Cmd and Alt combinations, and does not call `preventDefault()` on keys it does not handle.

Score 0 outright for a parallel mechanism: a hand-built native window through `openstation_register_window()` and a separate bundle instead of an app, a new REST route, or state kept in module-level variables or `localStorage` instead of the app's state.

### I. Edge cases the prompt does not spell out (0-2)

Award one point for each of the following that the diff handles explicitly (code or a test), up to 2:

- Enter on a focused keypad button: pressing Enter while, for instance, the `+` button has focus does not run `=` and press `+` at once (the button's own activation wins, or the view's handler skips keys whose target is a button).
- Accessible names: the symbol keys (×, ÷, −, ±, backspace, %) carry a spoken label (`aria-label` or `label`), wrapped in `__()`.
- Results too large for 12 significant digits are shown in a readable form (exponent notation or `Error`) rather than a long string that overflows the readout, and the user can recover from it.
- Comma as a decimal key on the keyboard (`,` maps to `.`), for keyboards whose numeric pad types a comma.

### D. Conventions (0-3; start at 3, subtract 1 per violation, floor 0)

Violations: hand-edited files under `assets/js/`; raw `fetch()` / `window.confirm` / `alert`; raw `<button>` or a hand-built readout where `<os-button>`, `<os-grid>` or `<os-display>` would do; a `--os-ui-*` token declared on a component `:host`; `@since` or other version stamps in comments or docs; introduced ESLint or PHPCS disables without a reason; a user-facing label next to `__()`-wrapped siblings that is not wrapped; hardcoded colours in the calculator's CSS instead of palette tokens, or the accent painted on every key (it marks state; an `=` key wearing it is acceptable).

### E. Tests (0-2)

- 2: The attempt's own tests cover the arithmetic rules that would plausibly regress (chaining, repeated equals, percent, rounding, Error recovery) through the pure engine, with one case per distinct path, and at least one test reaches the view or the keyboard mapping.
- 1: Tests exist but only cover the four basic operations, restate the implementation, or are many near-identical cases.
- 0: No test.

A new test file for a new app is expected here; do not penalise it.

### F. Docs (0-2)

- 2: `docs/app-framework.md` mentions the Calculator where it lists OpenStation's own apps (or as an example of a client-view app), and the controls and keyboard shortcuts are described somewhere a user or contributor would look (a `docs/` page or the app framework doc).
- 1: Only one of those.
- 0: No doc change.

### G. Scope discipline (0-2)

The contributor guide says public API additions (hooks, events, payload shapes) are proposed first and coded after the green light. The prompt fixed the surface: one app, one engine module with two exports.

- 2: Only what the task needs changed. No changes to the App Framework, the runtime or the component kit, no new hooks or `wp.os.*` methods, no reformatting of untouched code, no regenerated `languages/` files. A PHPUnit test for the new app is fine. An attempt that lists a framework change it would have liked as a decision for the maintainer, instead of making it, earns the full 2.
- 1: Minor unrelated churn, OR a change to shared code the task did not need (a new component, a runtime tweak, a new public hook).
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
