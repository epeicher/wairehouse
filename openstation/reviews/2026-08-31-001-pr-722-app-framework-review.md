# Review — PR #722, the App Framework (`.osx.php` + `.os.ts`), Code Blue rebuilt

*Reviewed 2026-08-31 against `feature/openstation-app-framework-code-bred` (993dd374) vs `trunk`. +10,969 / −3,963 across 90 files.*

**Verdict: the bet is sound and the execution is unusually disciplined, but merging it is a commitment to port more windows, not a free option.** The core idea (a window is a function of a typed state bag; server-rendered by default, client-rendered where latency demands) is proven prior art, implemented here with real restraint. Nothing found is a confirmed exploitable vulnerability. What should block the merge is small and mechanical: build output is committed in violation of the repo's own first hard rule, TypeScript source ships to wp.org, and two capabilities are advertised in the docs beyond what the code delivers.

Four independent passes were run (security/adversarial, architecture, backwards-compatibility, performance), and the highest-severity claims from each were re-verified by hand against the code before landing here.

---

## 1. What the PR actually proposes

An app is one PHP file. `App::define( $id )` declares the window (title, size, chrome, title-bar buttons, ⋯ rows, tabs, desktop icon, gate), a typed **state schema**, **actions**, and either a server `view()` or a `data()` feeding a client view in a `.os.ts` beside it. One shared runtime mounts it, POSTs triggers to a single route, and morphs the re-rendered HTML back in.

The framework core calls no WordPress function; six contracts (`Auth`, `Settings`, `Hooks`, `Cache`, `Env`, `Store`) have WordPress and standalone adapters. Code Blue is the reference port: 3,235 lines → 1,269.

---

## 2. Advantages

### 2.1 The economics are real from the second window onward

The old Code Blue shipped a 93.9 kB minified / 26.7 kB gzip bundle. The new open path is the shared runtime (19.3 kB min / 7.3 kB gzip) plus the app's own view (14.9 kB / 5.6 kB) — **34.2 kB min / 12.9 kB gzip, a ~52% gzip reduction** — and the runtime half is paid once for every future app. The `<os-histogram>` chart moved out of a private bundle into the shared kit, which is the pattern working as intended: a window's private code became reusable infrastructure.

### 2.2 Boot cost does not regress, which for this repo is the load-bearing claim

Given the active perf work on boot cost, this was the first thing checked. The runtime script and stylesheet are **registered but never enqueued** (`includes/framework/wordpress.php:150-171`); they ride the existing lazy native-window `script` path and load on first app-window open. Nothing outside `src/app-runtime/` imports it, so it is absent from `desktop.min.js`. Per-request PHP cost of scanning and loading `apps/` measured at **under 1 ms cold without opcache**, and trunk paid a comparable unconditional `includes/code-blue/bootstrap.php` require anyway. Boot payload grows by ~950 bytes of window config per app.

### 2.3 It rides existing machinery instead of inventing a parallel one

This is the finding that most changes the risk assessment. Apps register through the real `openstation_register_window()` / `_tab()` / `_icon()` on `init` @20, so they inherit session restore, the ⋯ menu, the tab strip, deep-linking and — critically — **live registration with no new payload key at all**. A third-party plugin's `.osx.php` appears without F5 through the existing `nativeWindows` + `nativeWindowScriptData` path; `menu-refresh-apply.ts` is untouched by this branch. AGENTS.md's "don't invent a different mechanism" rule is satisfied by not needing a mechanism.

### 2.4 The dispatch model is race-free by construction

Dispatches are chained (`session.ts:202-208`), so responses cannot arrive out of order and two clicks cannot race. Trunk's Code Blue had to hand-guard exactly this ("must never overwrite a newer one"). Polls are clamped to a 250 ms floor, reconciled to the elements actually rendered, and paused on window minimize, hidden tab, and in-flight request. All app traffic routes through `wp.os.fetch` with `windowId` + `source`, so it appears in the activity bus and window spinners like every other feature.

### 2.5 The client view genuinely removes the round trip

`os-bind` writes and `local` actions never leave the tab. Code Blue's range, search, sort, legend and row expansion are all local: one request to read the log, none to filter it. The docs state the ~235 ms round-trip floor openly (`docs/app-framework.md:302`) rather than hiding it, and prescribe the client view as the answer.

### 2.6 Security posture is better than what it replaced

Authorization is enforced twice — REST `permission_callback` (login + `App::allows()`) and again inside `Runtime::dispatch` — with all four status codes pinned by tests. CSRF is the standard WP nonce path. The escaping helpers are context-correct (`json()` HTML-escapes for attribute context so `</script>` cannot break out; `attr()` validates attribute *names*). `os-prop-*` JSON is assigned to element **properties**, never `innerHTML`. `$os->open_url()` is origin-gated, so the effects channel cannot be turned into script execution. Code Blue's gate is now *stronger* than trunk's: `manage_options` (network-aware) **and** developer mode, enforced on every dispatch, and the log source can only be selected from a server-derived list.

### 2.7 The test discipline is better than typical for a first cut

645 lines of PHP framework tests plus ~680 of vitest. Two guards deserve specific credit: the **line-budget test** (`codeBlue.php:396-410`) makes the framework's entire value proposition falsifiable — if the framework stops carrying its weight, a test fails; and `app-runtime-props-and-events.test.ts` scans the component kit and fails when the runtime's event list falls behind.

### 2.8 The migration note is exemplary

Every removed surface has a concrete replacement with exact keys to touch. The stale-reference sweep came back clean: no leftovers in `src/`, `vite.config.js`, `package.json` or the REST README.

---

## 3. Disadvantages and defects

### 3.1 Blocking: built app bundles are committed, violating the repo's first hard rule

**Verified.** `git ls-files assets/js/apps/` returns `code-blue.js` and `code-blue.min.js`. The `.gitignore` pattern `/assets/js/*.js` matches only the top level and was never extended to the new `apps/` subdirectory — while the sibling `assets/js/app-runtime.js` is correctly ignored. AGENTS.md's first hard rule treats everything under `assets/js/` as `dist/`. Consequences: minified diffs in every future PR, and a live hand-edit trap. One `.gitignore` line fixes it, but note the packaging interaction below before doing so.

### 3.2 Blocking: TypeScript source and a test file ship to wp.org

**Verified** with `git archive HEAD apps/`, which yields:

```
apps/code-blue/code-blue.os.ts
apps/code-blue/code-blue.test.ts
```

`.gitattributes` export-ignores `/src/` and `/tests/`, but nothing under `apps/`. This breaks the repo's own "source never ships" pattern. It also collides with 3.1: `bin/package.sh`'s `fileBase` sed only parses single-quoted literals and cannot see the app targets' template-literal `fileBase`, so the zip currently depends on git-archive shipping the committed bundles — which is presumably *why* they were committed. Fixing the gitignore without fixing package.sh would ship apps with no JS. **These two must be fixed together.** The zip also currently carries the unminified dev bundle, contradicting package.sh's stated "only the minified bundles ship" policy.

### 3.3 Two advertised capabilities outrun the code

**Third-party client views are not actually possible.** `@openstation/app` is a Vite alias to `src/app-runtime/client.ts`, which imports `../i18n` and `../ui/core/html` — both repo-internal. There is no published package and no global export. Yet `docs/app-framework.md:89` tells third parties to pass `App::client( $path )` with "the absolute path of the built file". Server-view `.osx.php` apps *are* genuinely third-party-usable; the client-view half is repo-internal until `defineApp`/`html` are published.

**Standalone mode is half-real.** The seam itself is clean (verified: zero WordPress calls in the core). But no CI job ever boots the framework with `OPENSTATION_STANDALONE` and no WordPress, and the one shipped app **cannot** run standalone — `code-blue.osx.php:56` and `log-reader.php` call `__()` nine times, which fatals on a bare PHP host. The "Standalone host in three lines" section has no shipped consumer. This is cheap YAGNI (the adapters earn part of their keep as a test seam) but the docs claim more than the code delivers.

### 3.4 The accounting behind "−61%" deserves stating plainly

Both line counts are honest and exclude tests. But the enabling code is new: **~3,750 lines of framework PHP + 1,662 of runtime TS + 855 of `os-histogram` ≈ 6,270 shared lines**, plus ~1,325 of new tests, to save ~1,970 in one app. Net maintained code is roughly **+5,500 lines**. The trade is negative today and turns positive around the **third or fourth ported window**. That is a defensible bet, but it is a bet, and the PR's framing invites reading it as a pure reduction.

### 3.5 Roughly 70 named things become public in one merge

5 PHP hooks, 1 REST route, 5 helpers, ~27 fluent builder methods, 6 contracts, 9 effects, 4 Html helpers, ~14 view attributes, `wp.os.apps`, the `@openstation/app` module, the manifest and dispatch wire shapes, and the file conventions. Every one is consistently marked **Experimental** — which is the right discipline and the repo demonstrably honors the legend (this very PR removes an Experimental surface with a migration note). The residual risk is scale plus the fact that the dispatch route lives under the frozen `desktop-mode/v1` namespace.

### 3.6 Window parity is claimed but not complete

`App::define` does not cover: **`preload_script`** (so a dock badge that updates while the window is closed is not buildable as an app — the `badge` effect only fires when an action runs); multiple companion scripts (actively forbidden by test) or stylesheets; `main_tab_label` / `main_tab_padding`; and full custom window chrome. Mitigation is real — the app *is* a native window, so a plugin can layer these from outside against the window id — but "everything a native window can do today" overstates it.

---

## 4. Adversarial findings

Framed as "how does this break, and who gets hurt". None is a confirmed exploitable vulnerability in shipped code; all are traps laid for the *next* app author.

### 4.1 The typed-state guarantee is false for array and null keys

`State::accept()` coerces only top-level scalars. For an `array()` default it returns the client value verbatim — and PHP's `is_array()` is true for JSON objects, so the key accepts **any** structure, any depth, arbitrary keys. A `null` default accepts anything. Yet the class docblock promises an action "can rely on" the declared type.

**The attack:** an author declares `'flags' => array()`, trusts it as `[name => bool]`, and feeds a key into `update_option()`, a file path, or a `$wpdb` query. Every one of those is now fully client-controlled with no schema enforcement. Code Blue is safe (its array keys are client-only re-slice data with no server sink), and it defensively re-validates anyway.

**Fix:** document the boundary loudly, and consider a shape validator — `toggle_item()` / `contains()` already assume a scalar-list shape and can be handed a nested map. There is no test asserting an array key resists a hostile nested payload, so this can regress silently.

### 4.2 An unescaped server view is not merely XSS — it is auto-dispatched action execution

The dispatch HTML path is deliberately **not** kses-filtered, unlike the `template`-callback path. The morph does `innerHTML` → `importNode` into the live DOM, and the session then wires every `os-action` / `os-bind` / `os-poll` it finds. So one unescaped untrusted field in a server view lets an attacker smuggle **runtime triggers** — most dangerously `<span os-poll="250" os-action="destructive">`, which fires on a timer with no user interaction and re-arms after every morph.

Code Blue avoids this entirely by rendering client-side through the auto-escaping `html` tag. But the framework offers no defense-in-depth on the path it recommends for "forms, settings, dashboards", and the docs do not warn that unescaped output here escalates beyond ordinary XSS.

### 4.3 The default gate is "any logged-in user", and there is no per-action authorization

**Verified** at `class-app.php:366-379`: with neither `capabilities()` nor `can()` declared, `allows()` returns `true` for any authenticated user. There is exactly one gate for the whole window — every declared action, including destructive ones, is reachable by anyone who clears it. You cannot declare "read view for everyone, mutating action for admins" without hand-checking `$os->can()` in each handler.

On a WooCommerce or membership site, every customer is an authenticated user. An author who writes `->action( 'delete_all', … )` and forgets a gate has exposed it to all of them. Consider defaulting to deny, or adding per-action capabilities.

### 4.4 `Os::standalone()` is an all-caps superuser waiting to be called from WordPress

It builds `new Standalone\Auth( 1, array( '*' ) )`, whose `can()` returns `true` for everything. Currently unreachable from the WP path (verified: only referenced in a docblock). But any future code that calls it to "render an app" server-side would run every gate as a superuser and bypass `allows()` completely. The default principal should be anonymous with opt-in for the `'*'` grant.

### 4.5 The morph's corner cuts, in the order they will bite

**Verified by reading `morph.ts`.** 160 lines is defensible here because event handling is fully delegated to the root and most controls are shadow-DOM components, so morphdom's hardest problems do not arise. Three real edges remain:

- **`<select>` value is assigned before its options exist.** `morphNode` calls `syncFormValue` (line 114) *before* `morphChildList` (line 115). A response that adds a new option and selects it via the select's value fails silently and is never retried — the setter is a no-op with no matching option. Works only if the server marks `selected` on the option. morphdom special-cases SELECT/OPTION for exactly this.
- **Duplicate `os-key`s are undefined behavior.** The keyed map keeps only the first (line 60); a second incoming node with the same key re-matches and re-moves the same live node. No dev warning.
- **`os-preserve` does not survive removal.** It blocks in-place morphing (line 108) but the child-list trim (lines 93-95) still deletes the node if the new HTML omits it. "The morph never touches this subtree" oversells it. Separately, `applyProps` queries `*` under the root unconditionally, reaching inside preserved subtrees.

None bites Code Blue. All three will bite the first server-view form app.

### 4.6 A slider in a server view queues one WordPress request per drag tick

**Verified.** The default 250 ms debounce applies only to `TEXT_EVENTS` — four event types, and `os-range-change` is not among them. `os-range-field` emits on every `input` during a drag. Dispatches are serialized but **never coalesced**, so N triggers become N sequential ~235 ms requests: a multi-second backlog from one drag. `os-button` gets `busy` only when *its* send starts, so rapid clicks queue too. `os-debounce` exists as a fix, but the default should not be a footgun; a stale queued `set` should collapse.

### 4.7 Code Blue's server-side cache introduces two subtle behavior changes

The new `$os->remember( key, 300, … )` around log reading is keyed on `path:size:mtime` only. On a default install with no persistent object cache this is a per-request no-op. On Redis/Memcached sites:

- `openstation_code_blue_entries` / `max_bytes` / `max_entries` now run **inside** the cache callback, so a filter change does not take effect until the file changes or the TTL expires. Names and signatures are unchanged, so this is invisible to filter authors.
- Cached entries embed **localized labels** with no locale in the cache key, so admins in different locales can see each other's labels for up to 5 minutes.

Neither is in the migration note.

### 4.8 Three formerly-pinned behaviors lost their tests

From the `codeBlue.php` diff: `test_read_source_entries_are_filterable` (the `openstation_code_blue_entries` filter now has **no PHPUnit coverage at all**), `test_read_source_caps_entries_keeping_newest` (the newest-kept cap is unpinned; neither `max_bytes` nor `max_entries` is touched anywhere in the new tests), and `test_level_for_label_mapping`. These are surviving *public* filters — the surface the migration note promises is unchanged — now unguarded.

### 4.9 Smaller sharp edges

- **`$os->toast( $msg, $tone )` silently ignores the tone.** Verified: `index.ts:75` forwards only `{ message }`, and `ToastOptions` has no tone field. Every `'success'` renders identically to an `'error'`. The session test asserts against a stub host, which masks it. Decide the contract before it freezes.
- **`os-on` with any unlisted event is a silent no-op** — listeners attach only for a fixed list, so a third-party component's event simply never fires.
- **`DEFAULT_EVENTS` and `App::normalise_control()` ↔ `ControlDef` are hand-synced with no guard**, despite AGENTS.md requiring the latter pair stay in sync. A new kit component's natural event silently falls back to `click`.
- **App bundles are keyed by file basename only**, so two apps in different directories sharing an `.os.ts` basename clobber each other. Unenforced.
- **The REST nonce is minted at registration and never refreshed**, so a desktop tab left open past nonce lifetime fails dispatches with a generic toast until reload.
- **The "10 kB runtime" claim is wrong in both directions.** Measured: 19,319 bytes minified, 7,321 gzip. Say "19 kB min / 7.3 kB gzip".
- **App directories are `include`d**, so any plugin that filters in a user-writable directory converts arbitrary-file-write into RCE. Safe today (directories come only from a PHP filter, never request input); worth documenting as a requirement.
- **Code Blue's clear-log confirm copy is declared twice** (PHP and TS) and has already drifted between them — the first concrete instance of the duplication risk the two-file split creates.

---

## 5. The strategic question

The technical review is favorable. The question the PR itself raises — "is this the right seam?" — comes down to three things:

**The seam is binary, not islands.** A server-view app with one hot control must rewrite its **entire** body in TypeScript, because a client view takes over the whole main root and tab panels stay server views regardless. The two view languages differ (echo-HTML vs tagged template), so crossing that line is a port, not an edit. If windows commonly need one instant control in an otherwise server-rendered body, this seam will be felt as a wall. Worth deciding deliberately before more ports.

**The vocabulary is well-bounded and should stay that way.** Eleven attributes, no client-side expressions, no conditionals, no loops, no partial swaps. Escape hatches are layered sensibly (`os-preserve` → `mounted( ctx )` → custom effects → full client view → classic native window). The pressure to add `os-if` / `os-for` will arrive with the second or third app; the answer should be the client view, and that should be written down now.

**Merging is a commitment.** At ~6,270 shared lines to save ~1,970, the framework is underwater until roughly the third or fourth ported window. Merging with no follow-up ports leaves the repo carrying a framework, a bespoke morph, and ~70 experimental public surfaces for one debug window. The line-budget test is the right instrument to hold that honest.

---

## 6. Recommendation

**Merge after the mechanical fixes, treating it explicitly as an experiment with a named second port.**

Before merge (small, and two of them interact):

1. Gitignore `assets/js/apps/*.js` **and** fix `bin/package.sh`'s `fileBase` parsing together (§3.1, §3.2) — either alone breaks the zip.
2. Export-ignore `apps/**/*.os.ts` and `apps/**/*.test.ts` so source stops shipping to wp.org.
3. Correct the docs on third-party client views and standalone mode (§3.3), and fix the "10 kB" figure.
4. Decide the toast-tone contract — implement it or remove the parameter.

Before a second app is written:

5. Document the array/null state boundary and the server-view escaping hazard prominently (§4.1, §4.2); add tests for both.
6. Fix the morph's `<select>` ordering and warn on duplicate `os-key`s (§4.5) — roughly an afternoon.
7. Give non-text events a sane default debounce or collapse stale queued `set` dispatches (§4.6).
8. Restore the three dropped Code Blue filter tests (§4.8) — they cover surface the migration note promises is unchanged.

Worth a decision, not a fix: the default-allow gate (§4.3) and the absence of per-action capabilities. That is a security-posture choice best made now, while the surface is still Experimental and there is exactly one app to migrate.

---

## 7. Re-review — 2026-09-01, tip `a50bf071`

Six commits landed in response (including a trunk merge). Every item verified against the code, not the commit messages.

| Item | Resolution | Verified |
|---|---|---|
| §3.1 Committed bundles | `/assets/js/apps/` gitignored; `package.sh` now walks `apps/*/*.os.ts` itself and `mkdir -p`s the archive dir; CI builds views before PHPUnit | `git ls-tree` empty, package.sh diff read |
| §3.2 Source in zip | `apps/**/*.ts export-ignore`; zip carries only `.os.php` + `log-reader.php` + `.css`; only `.min.js` spliced (dev bundle no longer ships) | `git archive` listed |
| §3.3 Doc claims | Client views marked "inside this repo only, for now" with a callout; standalone marked "the shape of the contract rather than a supported install mode", naming Code Blue's `__()` limitation; PR body says 19 kB | docs + PR body read |
| §3.4 Toast tone | Parameter removed from `Effects::toast()` / `Os::toast()`; docs explain `<os-notice tone>` as the alternative | signatures read |
| §4.1 State typing | Documented in a new "The gate is the only authorization there is" section; pinned by `test_state_typing_is_top_level_only_for_array_keys` | test present |
| §4.2 Server-view escaping | Same section documents the exact `os-poll` trigger-injection escalation | doc read |
| §4.3 Default gate | Decision made and documented: default matches `openstation_register_window()`; docs command declaring a gate on every app and `$os->can()` for hotter actions. Behavior unchanged, consciously | doc read |
| §4.5 Morph edges | `<select>` children now morph before `syncFormValue`; duplicate `os-key` spends the key so the duplicate inserts fresh | morph.ts diff read |
| §4.6 Slider debounce | `TEXT_EVENTS` became `CONTINUOUS_EVENTS`, including `os-range-change` | bindings.ts diff read |
| §4.7 Cache drift | Cache removed outright, with the freshness/filter/locale reasoning written into the code | log-reader read |
| §4.8 Dropped tests | All three restored: entries filterable, cap keeping newest, `level_map` | tests present |

Beyond the review: `.osx.php` renamed to `.os.php` (complete, AGENTS.md and docs updated, zero leftovers), and the runtime paint paths unified into one `finishRender()`, which also fixed a real gap (a local paint never loaded missing kit components). CI is green on PHP 8.3/8.4, Vitest, build, and Plugin Check, which answers the one thing the first pass left unverified.

**Verdict: good to merge.** Remaining known limitations (per-action authorization, standalone as a supported mode, third-party client views) are documented rather than implemented, which is the right posture for an Experimental surface. The strategic note stands: merging commits the project to porting more windows, so name the second port.
