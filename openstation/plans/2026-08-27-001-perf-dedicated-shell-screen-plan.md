---
title: "perf: Serve the shell from its own admin screen"
type: perf
status: draft
date: 2026-08-27
---

# perf: Serve the shell from its own admin screen

## Summary

Today the desktop shell is painted *over* whatever admin screen the portal happens to forward to: `/openstation/` resolves a target (`?target=`, else the last-focused window, else the Dashboard), appends `desktop_mode_portal=1`, and redirects there; `in_admin_header @ 5` then injects `<div id="os-shell">` on top. The shell document therefore inherits the entire script and style queue of one real admin screen, plus that screen's server-side render, and the same screen is then loaded again inside a window. This plan moves the shell to a dedicated, menu-hidden admin page (`admin.php?page=openstation`) whose only enqueues are OpenStation's own and the every-admin-page baseline. The portal keeps its URL and its frozen query vars; the `target` the portal already resolves becomes a parameter the shell page reads instead of a screen it rides on.

---

## Problem Frame

The perf series (#661 through #684) removed the Core command-palette runtime from the shell document, and #688 made that trim respect the dependency graph. The moment it did, the shell page on any site running the Gutenberg plugin went from 117 requests / 4.2 MB raw to 162 requests / 20.0 MB raw / 3.9 MB gzipped: Gutenberg's experimental "Dashboard (Beta)" page enqueues its loader on `index.php`, that loader legitimately depends on `wp-editor`, and since the shell document *is* `index.php`, the whole editor closure is now printed, parsed and executed in the shell's realm, where nothing ever renders it. Trunk was smaller only because its path-based core-package test misfiled Gutenberg's `wp-*` packages as plugin contributors and hoisted them regardless of who depended on them, which is the bug that emptied the Customizer's Widgets panel.

Gutenberg is the loudest instance, not the problem. Because the portal forwards to the *last-focused window's URL*, the shell page can just as easily be `edit.php` (list-table scripts, `inline-edit-post`), `post.php` (the full block editor), or a plugin screen; whatever it is, its scripts print on the shell, its render callback runs on the server, and its HTML sits hidden under `position: fixed`. Even the default case pays for `dashboard.js`, `edit-comments.js`, `updates.js`, `site-health.js`, `postbox.js`, every dashboard widget's markup, and Site Health's checks.

The 2026-08-24 boot-cost plan already recorded the symptom from the other side: #664's claimed 3.6 MB saving measured as 65 KB on a default instance "because Gutenberg's Dashboard page re-imports the same dependency closure the PR defers". Every deferral so far has been fighting the enqueue list of a screen the shell never shows. The durable fix is to stop borrowing a screen.

---

## Requirements

- R1. The shell document is served by a screen OpenStation owns, on which no other admin screen's scripts, styles, notices or render callback run.
- R2. `is_admin()` is true and `admin_menu` / `admin_enqueue_scripts` fire on the shell page exactly as today. Every `openstation_register_*` call site in third-party plugins keeps working unchanged.
- R3. `/openstation/` remains the canonical entry URL and keeps resolving a target the same three ways (explicit `target`, last-focused window, default window).
- R4. `desktop_mode_portal` and `desktop_mode_portal_intent` are frozen (AGENTS.md). Any admin URL carrying them keeps working, as a redirect to the shell page with that URL as the target.
- R5. Plain admin GETs (`/wp-admin/edit.php` typed or bookmarked) keep redirecting into the desktop with the page opened as the first window, via the existing `openstation_admin_redirect_to_portal` filter.
- R6. Session restore, `defaultWindow` (including `native:` markers), the auto-open matrix in `src/boot/auto-open.ts`, live menu refresh and the chromeless bridge behave identically. The shell must not be able to tell which screen it used to ride on.
- R7. A boot-cost assertion on a Gutenberg-plugin fixture pins the result, so the next upstream enqueue on `index.php` cannot silently undo it.
- R8. Documented as a migration note for anyone who keyed shell behaviour on `$pagenow`, `get_current_screen()`, or `load-index.php`.

---

## Scope Boundaries

**In scope**

- One hidden admin page per admin context the shell already supports, its render callback, and the routing changes that send the portal there.
- Moving the `currentPage` / `fromPortal` / `fromPortalIntent` derivation in `includes/render/assets.php` from "the URL this request is on" to "the target this request carries".
- Trimming, on the shell page only, what the every-admin-page baseline still brings, behind a filter operators control.
- Tests: redirect matrix, boot-cost fixture, PHPUnit for the new screen.

**Out of scope**

- **Windows.** Chromeless documents keep #688's dependency rule unchanged; the survivor protection is correct there and this plan does not touch it.
- **The palette trim itself.** `chromeless-trim.php` stays as merged. With almost no survivors on the shell page it simply has nothing to protect.
- **`desktop.js` size.** At 1.28 MB raw it becomes the largest single asset on the shell page once the screen inheritance is gone; that is the next plan, not this one.
- **Solo mode** (`?openstation_solo=`) and the classic escape hatch (`desktop_mode_classic`), which are their own request kinds and unaffected.
- **A standalone non-admin document.** See KD1 for why it was rejected.

---

## Context & Research

**How the shell is hosted today** (`includes/portal.php`, `includes/render/shell.php`, `includes/render/assets.php`):

- `openstation_handle_portal_request()` on `parse_request`: validates `?target=` through `openstation_sanitize_portal_target()` and `openstation_admin_target_allowlist()`, else `openstation_portal_entry_url()` (focused session window, else the user's default window, else `admin_url()`), adds `desktop_mode_portal=1` (+ `_intent` when explicit), `wp_safe_redirect()`.
- `openstation_redirect_plain_admin_to_portal()` on `admin_init`: any plain admin GET without the flag is sent to `/openstation/?target=<that URL>`.
- `openstation_render_shell()` on `in_admin_header @ 5` renders whenever the user is enabled and the request is neither chromeless nor classic. There is no "shell request" predicate; the shell renders on whichever admin screen the flag lands on.
- `assets.php` builds `currentPage` from `$pagenow + $_GET` minus the two flags; `src/boot/auto-open.ts` and `src/boot/session.ts` decide what to open from `currentPage`, `fromPortal`, `fromPortalIntent`, `defaultWindow` and the saved session.

**What the inherited screen costs**, measured 27 Aug on the QA instance (WP 7.1, Gutenberg 23.6, TT5), `node bin/boot-cost.mjs --path /wp-admin/`:

| shell document rides on | requests | raw | gz | `wp-*` package scripts |
|---|---:|---:|---:|---:|
| `index.php`, trunk bc557fa0 (accidental hoist) | 117 | 4.22 MB | 1.02 MB | 10 |
| `index.php`, #688 head bddfa73a | 162 | 20.04 MB | 3.87 MB | 55 |
| `index.php`, #688 head, Gutenberg plugin off | 101 | 3.66 MB | 0.94 MB | 8 |
| `edit.php?openstation_chromeless=1` (for scale: one window) | 44 | 1.35 MB | 0.37 MB | 0 |

Server side, #688's own measurement puts a full admin screen at ~600 ms against ~515 ms for a bare WordPress bootstrap (`admin-ajax.php` no-op). The shell page pays the screen render today and never shows it.

**Precedents in-tree.** The plugin already serves two non-screen endpoints through `parse_request` (`/openstation/sw.js`, `/openstation/manifest.webmanifest`, `includes/pwa.php`), already registers admin pages (Preferences is a native window, but `includes/os-settings.php` and the extended-options screen show the registration pattern), and already validates redirect targets. Nothing new is invented; the pieces are rearranged.

---

## Key Technical Decisions

- **KD1. A hidden admin page, not a standalone document.** `admin.php?page=openstation` registered with a blank parent so it never appears in the menu, capability `read` (the same gate `openstation_is_enabled()` applies per user). Rejected: serving the shell from `/openstation/` directly via `parse_request`. It would be leaner still, but `is_admin()` would be false and `admin_menu` / `admin_enqueue_scripts` would not run; those are the documented contract behind every `openstation_register_*` call, the menu-payload harvest, and every plugin that gates registration on `is_admin()` at load time (AGENTS.md records why the payload must be captured in real admin context). The admin page keeps all of that for free.

- **KD2. The portal redirects to the shell page carrying the target as a parameter.** `/openstation/` → `admin.php?page=openstation&target=<validated admin URL>[&intent=1]`, one hop, same as today. `openstation_sanitize_portal_target()` and the allowlist are reused unchanged; the shell page re-validates on read, so the parameter is never trusted from the URL alone. `currentPage` is derived from `target`; absent or invalid, it falls back to `openstation_portal_entry_url()` exactly as the portal does now. `fromPortal` is true by construction on the shell page; `fromPortalIntent` maps to `intent=1`.

- **KD3. The frozen flags become aliases, not dead code.** `openstation_redirect_plain_admin_to_portal()` already intercepts plain admin GETs; it grows one branch: a request carrying `desktop_mode_portal=1` on any screen other than the shell page redirects to the shell page with that URL as `target` (and `intent=1` when the intent flag was present). Old bookmarks, the legacy `/desktop-mode/` path, and anything a plugin generated with the flag keep working. The constants, their docblocks and the query-var registration stay exactly as they are.

- **KD4. The shell page's render callback is empty; the shell keeps rendering from `in_admin_header @ 5`.** Moving the markup into the page callback would put it *after* `admin-header.php` prints notices and the admin bar, changing stacking and the `os-active` body-class timing. Keeping the hook and adding a screen check (`openstation_is_shell_request()`, true only on the new screen) is the smaller, safer change, and gives the codebase the predicate it currently lacks.

- **KD5. What still prints is baseline, and a filter decides the rest.** With no host screen, the queue is OpenStation's assets plus Core's every-admin-page set (`common`, jQuery, `admin-bar`, `heartbeat`, `wp-auth-check`, `utils`, `svg-painter`) plus whatever plugins enqueue on every admin page. The first two the shell uses. For the third, add `openstation_shell_dequeue_handles` (scripts and styles, default empty) so an operator can name a global nag or tracker they never want in the shell. No heuristic: the framework does not guess which globally-enqueued script "belongs" in the shell; the site says so. This follows the event-driven rule in AGENTS.md (app owns the policy).

- **KD6. Network admin gets a twin screen only if the shell already runs there.** `openstation_is_enabled()` and the portal do not distinguish network admin today; the palette payload carries `is_network_admin`. Register on `network_admin_menu` as well only if a network-admin boot is a supported path (OQ1); otherwise network admin URLs keep redirecting to the site-admin shell as they do now.

- **KD7. Pin the result with a boot-cost assertion, not a review habit.** The CI boot-cost plan (2026-08-24) is the natural home: a third row, "Gutenberg active, shell page", whose `wp-*` package count is asserted near zero. Until that lands, a PHPUnit test that boots the shell screen with a synthetic `wp-editor` enqueue on `index.php` and asserts it is absent from the shell page's print list is the minimum.

---

## Open Questions

- **OQ1. Network admin.** Is a network-admin desktop a supported boot today, or does everything funnel to the site admin? Decides whether KD6 registers a second screen. Needs a check on a multisite wp-env before U1.
- **OQ2. Screen identity for plugins.** `get_current_screen()->id` on the new page will be `admin_page_openstation`. Any plugin that showed something in the shell only because it checked for `dashboard` will stop; the Dashboard window still gets it. Worth a code search across the in-tree extensions (`extensions/`) and the compat layer (`includes/compat/`) before assuming zero.
- **OQ3. Redirect hop budget.** A plain admin GET currently costs two redirects (`edit.php` → `/openstation/?target=` → `edit.php?desktop_mode_portal=1`). KD2 keeps it at two. Could the `admin_init` interceptor go straight to the shell page and skip the portal hop? Yes, but the portal is where `openstation_portal_auto_enable` and the same-origin user-meta mutation live; skipping it would need those to move. Proposal: keep two hops in P1, revisit in P2 with the auto-enable logic factored out.
- **OQ4. Does the admin bar still need the host screen?** `includes/admin-bar.php` builds the OpenStation toggle and shortcuts popover; the shell hides Core's bar but reads its markup. Confirm nothing in it depends on `$pagenow === 'index.php'`.
- **OQ5. Speculative-document store and prewarm.** Both key on chromeless URLs, not the shell URL; a quick check that neither treats `admin.php?page=openstation` as a window target (it must never be opened in a window; add it to the deny side of `isSpeculatableDocument()` and the native-window remap for safety).

---

## High-Level Technical Design

```
GET /wp-admin/edit.php                      (plain admin, user enabled)
  admin_init: openstation_redirect_plain_admin_to_portal()
    → 302 /openstation/?target=/wp-admin/edit.php            (unchanged)

GET /openstation/?target=…                  (parse_request)
  openstation_handle_portal_request()
    resolve target: explicit → session focused → default window → admin_url()
    → 302 /wp-admin/admin.php?page=openstation&target=<url>&intent=1   (KD2)

GET /wp-admin/index.php?desktop_mode_portal=1              (old bookmark)
  admin_init: alias branch (KD3)
    → 302 /wp-admin/admin.php?page=openstation&target=/wp-admin/index.php

GET /wp-admin/admin.php?page=openstation&target=…           (the shell page)
  admin_menu:            hidden page registered, callback no-op
  admin_enqueue_scripts: openstation_enqueue_assets() as today
                         openstation_shell_dequeue_handles filter (KD5)
  assets.php:            currentPage  ← validated target (fallback: entry url)
                         fromPortal   ← true
                         fromPortalIntent ← intent=1
  in_admin_header @ 5:   openstation_render_shell() guarded by
                         openstation_is_shell_request()          (KD4)
  page callback:         nothing
```

**Predicate.** `openstation_is_shell_request()`: `is_admin()` and `get_current_screen()`/`$plugin_page === 'openstation'` (screen may not exist yet at `admin_init`, so the `$plugin_page` global is the early check). Replaces the implicit "enabled and not chromeless and not classic" in `shell.php`, `body-classes.php` and `assets.php`, all of which currently mean "shell" without saying so.

**What the JS sees.** No change to the `openStationConfig` shape. `currentPage` continues to be a clean admin URL, so `deriveWindowId()` and the dock agree on ids, and `auto-open.ts` cases 2 to 6 hold. The only observable difference is `location.href` of the shell document, which nothing in `src/` reads for routing (worth a grep at U3 to be sure: `location.pathname` / `location.search` consumers).

**Expected outcome on the Gutenberg-plugin fixture.** The 162-request / 20 MB shell page drops to OpenStation's 32 requests / 1.8 MB plus the Core baseline (~15 requests, ~0.6 MB), independent of what Gutenberg or any plugin enqueues on `index.php`; one admin-screen render fewer per boot; a document that no longer carries the Dashboard's hidden HTML.

---

## Implementation Units

- **U1. Shell screen registration + predicate.** `includes/render/shell-screen.php`: `add_submenu_page( '', …, 'read', 'openstation', '__return_empty_string' )` on `admin_menu` (and `network_admin_menu` per OQ1), `openstation_is_shell_request()`, and `remove_submenu_page` hygiene so it never highlights a menu. Acceptance: `admin.php?page=openstation` returns 200 for an enabled Subscriber and Administrator, 404-equivalent for a disabled user is *not* required (they get the classic admin, as today); `get_current_screen()->id === 'admin_page_openstation'`.

- **U2. Portal → shell page.** `openstation_handle_portal_request()` redirects to the shell page with `target` / `intent`; `openstation_redirect_plain_admin_to_portal()` gains the KD3 alias branch. Acceptance: PHPUnit redirect matrix, nine cases: {`/openstation/`, `/openstation/?target=…`, `/desktop-mode/`} × {no session, focused session window, native default window} plus the three flagged-URL aliases; each asserts the exact `Location`.

- **U3. Target-driven boot config.** `assets.php` derives `currentPage` / `fromPortal` / `fromPortalIntent` from the validated `target` (fallback `openstation_portal_entry_url()`), and `body-classes.php` / `shell.php` use the predicate. Acceptance: existing `Tests_OpenStation_Render` and the `auto-open` vitest cases pass unchanged; a new PHPUnit case asserts `currentPage` for an explicit target, an invalid target (falls back), and a `native:` default window.

- **U4. Shell-page dequeue filter.** `openstation_shell_dequeue_handles` applied at `admin_enqueue_scripts` PHP_INT_MAX on the shell page only, scripts and styles, with the closure protection from #688 reused so a filter value can never strand a dependency. Acceptance: PHPUnit asserts a filtered handle and its now-orphaned deps are absent, and that a handle a survivor depends on is refused with a `_doing_it_wrong()`.

- **U5. Safety denials.** Add the shell page URL to `isSpeculatableDocument()`'s refusals, the dock/prewarm acting-URL predicate, and the native-window remap so it can never be opened inside a window. Acceptance: vitest cases for each predicate.

- **U6. Boot-cost pin.** Either the third CI row from the 2026-08-24 plan or, until that exists, a PHPUnit test that enqueues a fake `wp-editor` root on `index.php` and asserts the shell page prints no `wp-*` package beyond the baseline. Acceptance: the test fails on today's trunk and passes on the branch.

- **U7. Docs.** `docs/architecture.md` PHP flow (steps 1 and 4 change), `docs/javascript-reference.md` portal section (the shell URL, `target`), `docs/hooks-reference.md` (new filter, new predicate), and `docs/migration-shell-screen.md` (R8).

---

## System-Wide Impact

- **Every boot** pays one admin-screen render fewer and stops downloading, parsing and holding whatever that screen enqueued. Memory in the shell realm drops by the size of React + editor stores on Gutenberg-plugin sites, for the lifetime of the desktop session.
- **Plugin authors:** no API change. `openstation_register_*`, the payload shape, `wp.os.*`, and the events are untouched. The only observable change is the shell document's URL and screen id (R8).
- **The palette trim (#688)** keeps working unchanged in windows; on the shell page its survivor set shrinks to the baseline, so the "Gutenberg-plugin site prints the editor chain" case disappears without touching the trim.
- **Redirect surface:** one new redirect target, validated by the existing sanitiser and allowlist, and one alias branch. The `wp_redirect` preservation filters (`openstation_chromeless_preserve_redirect`, `_classic_preserve_redirect`) are unaffected because they act on chromeless and classic requests, never the shell.
- **The 2026-08-24 CI plan** gains its most useful row: the shell page measured with Gutenberg active becomes a stable number instead of a moving target.

---

## Risk Analysis & Mitigation

- **A plugin that only worked in the shell because the shell was the Dashboard.** Something hooked on `load-index.php` or checking `screen->id === 'dashboard'` that happened to render into the shell. Mitigated by OQ2's search and by R8's migration note; the Dashboard window keeps it either way.
- **`target` as an open redirect.** Mitigated by reusing `openstation_sanitize_portal_target()` and the allowlist on *both* the portal and the shell page (KD2), and by `wp_safe_redirect()`.
- **Frozen-flag regression.** A bookmark with `desktop_mode_portal=1` must not land on a bare classic screen. Mitigated by KD3 and the alias cases in U2's matrix.
- **Redirect loops.** The interceptor must exempt the shell page itself, `admin-post.php`, `admin-ajax.php`, REST and non-GET exactly as today. Mitigated by keeping those guards and adding the shell-page exemption first in the chain; U2 asserts a shell-page GET is not redirected.
- **Every-admin-page plugin scripts still print.** They did before too; this plan does not claim to remove them, only to stop inheriting a screen. KD5's filter is the operator's lever; the boot-cost row shows what remains.
- **Session-restore edge: focused window URL is the shell page.** Impossible once U5 denies the shell URL to the window manager, but the sanitiser must also refuse `admin.php?page=openstation` as a `target`, or the shell would open itself in a window.

---

## Phased Delivery

- **P1. Screen + routing + parity.** U1, U2, U3, U5, U7. Ship with the boot behaviour byte-for-byte equivalent from the user's side; measure the shell page on the Gutenberg fixture and record the number in the PR.
- **P2. Trim the baseline.** U4's filter, plus a pass over Core's every-admin-page set to see whether anything the shell does not use (`svg-painter`, `wp-util`'s templates) can be dequeued by default without a heuristic. Only after P1 has shown the redirect matrix is stable.
- **P3. Fold the portal hop (OQ3)** if the two-redirect entry is worth the refactor of the auto-enable logic, and hand the boot-cost row to the CI plan as its permanent guard (U6 becomes the CI assertion).

---

## Documentation Plan

- `docs/architecture.md`: rewrite the "PHP flow (per request)" list; step 1 becomes "portal resolves a target and forwards to the shell screen", step 4 becomes "`in_admin_header @ 5` renders the shell on the shell screen only".
- `docs/javascript-reference.md`: the portal section names the shell URL and the `target` / `intent` parameters; `currentPage` semantics unchanged and said so.
- `docs/hooks-reference.md`: `openstation_shell_dequeue_handles` (Experimental) and `openstation_is_shell_request()` (Stable, PHP helper).
- `docs/migration-shell-screen.md`: who is affected (anything keyed on the shell being the Dashboard), the new screen id, the alias behaviour of the frozen flags.
- AGENTS.md: one line under the frozen-values table noting that `desktop_mode_portal` is now an alias redirect, still frozen.

---

## Sources & References

- `includes/portal.php` (`openstation_handle_portal_request`, `openstation_redirect_plain_admin_to_portal`, `openstation_portal_entry_url`, `openstation_sanitize_portal_target`), `includes/render/shell.php`, `includes/render/assets.php` (`currentPage` derivation), `includes/core/routing.php` (request kinds, redirect preservation).
- `src/boot/auto-open.ts` (the six-case entry matrix) and `src/boot/session.ts` (`currentPage` remap).
- PR #688 and its `openstation_protect_survivor_dependencies()`, the rule this plan keeps.
- `docs/plans/2026-08-24-001-ci-boot-cost-regression-table-plan.md`, whose "Gutenberg's Dashboard page re-imports the same dependency closure" observation is the earlier sighting of this problem, and whose CI row this plan feeds.
- Measurements above: `node bin/boot-cost.mjs --base http://localhost:8879 --path /wp-admin/`, 27 Aug 2026, wp-env instance `402d5ed0…`, WP 7.1, Gutenberg 23.6.0, `desktop_mode_extended_options` `{"media_library_enhanced":true,"games":false,"agents":true}`.
- Gutenberg `lib/experimental/dashboard-widgets/load.php` (the "Dashboard (Beta)" page, slug `dashboard-wp-admin`) and `build/pages/dashboard/loader.js`, the enqueue root on `index.php`.
