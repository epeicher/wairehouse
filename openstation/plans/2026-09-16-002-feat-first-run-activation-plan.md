# First-run activation: install stamp, activation nudge, shell tour

**Repo:** alcazaba-plugin (OpenStation, wp.org slug `desktop-mode`), trunk at 1.1.9
**Origin:** [Marketing strategy, section 6](../marketing/2026-09-16-installs-north-star-marketing-strategy.md): "An install nobody turned on gets deleted at the next plugin cleanup."
**Pairs with:** [Deactivation feedback dialog](2026-09-16-001-feat-deactivation-feedback-dialog-plan.md), which reads the two stamps this plan adds.

## The problem

OpenStation is opt-in per user. A site admin installs and activates the plugin, and nothing changes until somebody clicks the admin-bar toggle. Today the only prompt is the welcome dialog (`includes/welcome-dialog.php`): a modal that shows once per user on the next classic-admin visit, with an "Enable it now" button. Dismiss it, and the plugin is silent forever. There is no in-shell orientation once a user does turn it on, and the site has no record of when it was installed or when anyone first enabled it, so "did this install ever activate?" is unanswerable, on the site and for us.

## What ships

Four pieces, in dependency order:

1. **Two stamps.** `openstation_installed_at` (site option) and `openstation_first_enabled_at` (site option), plus `openstation_enabled_at` (user meta). Cheap, and everything else reads them.
2. **A "Turn on" plugin row action** on `plugins.php`, permanent, one link.
3. **An activation nudge**: a dismissible admin notice on Dashboard and Plugins, for admins, while nobody on the site has enabled OpenStation and the install is under 14 days old.
4. **A 20-second shell tour** on a user's first boot: open a window, snap it, press ⌘K. Three coachmarks, Skip at every step, replayable from Preferences.

And the measurement: "enabled by at least one user within 7 days of install" is computed on the site from the stamps, exported through the deactivation-feedback payload, and (optional, section 6) through a one-time opt-in ping.

## Design decisions

1. **Stamps are the foundation and ship first.** Without `installed_at` no age-based gate works, and the deactivation dialog's funnel fields stay `null`.
2. **The welcome dialog stays as is.** It is the first touch. The nudge is the second, quieter touch for the same admin after they dismissed the modal, and it lives where plugin admins look (Dashboard, Plugins). Both stop the moment anyone on the site enables.
3. **The nudge is a Core admin notice, not a shell surface.** By definition the shell is not running for the people it targets.
4. **The tour is driven by real events, with a button as fallback.** Each step completes when the user actually does the thing (a window opens, a snap commits, the palette opens). A "Do it for me" button on each step exists so nobody is stuck, and the tour never blocks the desktop with a scrim: the user has to be able to drag a window during step 2.
5. **Tour state lives in the seen-intros registry**, slug `shell-tour`. `includes/seen-intros.php:14-16` names this as the intended home for show-once flags. It gives per-user persistence across browsers, the existing "Reset what's-new dialogs" button, the `os-intros-reset` event, and the boot payload key `seenIntros`, with no new REST route or user meta.
6. **Existing users do not get the tour on update.** A migration marks `shell-tour` seen for every user with prior desktop use. Reset brings it back for anyone who wants it.
7. **The coachmark is a new kit component**, `<os-coachmark>`, because an anchored callout with a step counter is generic (AGENTS.md, "Use os-* components": build the generic shape as a component). The tour module is the feature-specific driver.

## 1. Stamps

### Storage

| Name | Kind | Value | Written |
|---|---|---|---|
| `openstation_installed_at` | option, autoload no | `{ "at": <epoch seconds>, "via": "activation" \| "backfill" }` | activation hook; `admin_init` backfill when absent |
| `openstation_first_enabled_at` | option, autoload no | same shape, `via` also `"backfill"` for installs that already had enabled users | first time any user enables; migration backfill with `at: 0` |
| `openstation_enabled_at` | user meta | epoch seconds | first time this user enables |

New stores take the `openstation_` prefix; recent precedents are `openstation_presence_storage` (`includes/presence-store.php:12`) and the `openstation_station_home_card_preferences` user meta (`includes/station-home/cards.php:16`). Constants in the module, string values in `docs/data-model.md` (options table at line 284, user-meta table at 252, and the module matrix at 193).

### Where they are written

- **Install:** a new activation callback next to the three existing ones (`includes/migrations.php:126`, `includes/desktop-files/schema.php:669`, `includes/games/schema.php:173`), writing `installed_at` only if absent. Activation does not fire on an update in place, so a lazy `admin_init` backfill writes `{ at: time(), via: 'backfill' }` when the option is missing. A backfilled age is wrong for old installs, and `via` says so; the deactivation payload sends `install_age_days: null` when `via` is `backfill` and the migration below has not corrected it.
- **Enable:** `openstation_ajax_save()` (`includes/ajax.php:40`) is the toggle's only writer, and the portal's auto-enable (`includes/portal.php:151-153`) is the second path. Both get the same three lines: stamp `openstation_enabled_at` on the user if absent, stamp `openstation_first_enabled_at` on the site if absent, and fire a new action:

```php
do_action( 'openstation_user_enabled', $user_id, $first_on_site );
```

There is no enable/disable action today (the research found none among about 115 actions). Add the matching `openstation_user_disabled` on the `''` branch while there; both go in `docs/hooks-reference.md`. Factor the stamping into `openstation_record_user_enabled( $user_id )` in the new module so the two call sites cannot drift.

### Migration 9

Bump `OPENSTATION_MIGRATION_VERSION` (`includes/migrations.php:63`) to 9 and add the branch in `openstation_run_pending_migrations()` (lines 129-165), documented in the file-header list (which currently stops at 6; add 7, 8 and 9 while there):

1. If `openstation_installed_at` is absent, write it with `via: 'backfill'`. Use the earliest `openstation_enabled_at`-less proxy available: the modification time of `desktop-mode.php` is a reasonable floor; if that is unreliable, `time()`.
2. If `openstation_users_with_prior_desktop_use()` (already in `migrations.php`) is non-empty, write `openstation_first_enabled_at` as `{ at: 0, via: 'backfill' }` and `openstation_mark_intro_seen( $user_id, 'shell-tour' )` for each of those users.

### Module

`includes/first-run/bootstrap.php` + `stamps.php` + `nudge.php`, required from `desktop-mode.php` after `includes/network/bootstrap.php` (line 197). The nudge's `admin_notices` hook only fires in wp-admin, so it could live in the admin-only block at lines 207-216, but the stamps must load everywhere (REST, ajax, portal). Keep the module unconditional and let `nudge.php` hook `admin_notices` harmlessly.

## 2. "Turn on" row action

`plugin_action_links_` . `plugin_basename( OPENSTATION_FILE )`: prepend a link. When `openstation_is_enabled()` is false for the current user, "Turn on OpenStation" pointing at the portal URL (`openstation_portal_url()` or whatever `includes/admin-bar.php:705-730` uses for `portalUrl`), which auto-enables through `openstation_portal_auto_enable` and lands in the shell. When enabled, "Open OpenStation" to the shell URL. The portal's same-origin CSRF check accepts a click from `plugins.php`. Network admin: same filter with the `network_admin_` prefix. Gate the enabling link on `current_user_can( 'read' )` (the toggle's own cap) so it matches `openstation_ajax_save()`.

This is the one change in this plan that costs nothing and helps every user forever: "Plugin activated" is the moment people read the row.

## 3. Activation nudge

`nudge.php`, hooked on `admin_notices` (and `network_admin_notices`) at priority 10.

Show when all of these hold:

- `current_user_can( 'activate_plugins' )`
- `! openstation_is_enabled()` for the current user
- `openstation_first_enabled_at` is absent (nobody on the site has ever enabled)
- install age under 14 days by `openstation_installed_at`, and `via` is `activation` (backfilled installs are old; do not nag them)
- `get_current_screen()->id` is `dashboard` or `plugins` (or their network twins)
- not a chromeless request (`openstation_is_chromeless_request()`)
- `! openstation_has_seen_intro( $user_id, 'activation-nudge' )`
- `apply_filters( 'openstation_show_activation_nudge', true, $user_id )`

Markup: `wp_admin_notice()` when it exists (WP 6.4+; the plugin requires 6.0, so fall back to the same `div.notice.notice-info` markup) with two actions: **Turn on OpenStation** (the portal link, primary button) and **Not now** (dismiss). Dismissal must persist, and Core's `is-dismissible` is client-only, so the "Not now" button carries a small inline script that POSTs `{ slug: 'activation-nudge' }` to `rest_url( 'desktop-mode/v1/intros/seen' )` with a `wp_rest` nonce, exactly as `includes/welcome-dialog.php:96-97` does, then removes the notice.

The seen-intros permission callback (`includes/seen-intros.php:190-233`) allows exactly one slug for users who do not have OpenStation enabled: `activation-welcome`. Add `activation-nudge` to that allowlist with the same rationale; the test in `tests/phpunit/tests/` that pins the allowlist gets a second case.

Copy: one sentence, no marketing voice in an admin notice.

> **OpenStation is installed but not turned on.** It changes wp-admin only for the people who turn it on. [Turn on OpenStation] [Not now]

## 4. Shell tour

### `<os-coachmark>`

`src/ui/components/os-coachmark/` with `os-coachmark.ts`, `os-coachmark.styles.ts`, `os-coachmark.test.ts`, registered in `src/ui/components/index.ts`, documented in its `static help` block.

Public surface:

| Prop / attr | Meaning |
|---|---|
| `open` | shown or not |
| `anchor` (property, `Element \| null`) | the element the card points at and outlines; `null` centers the card in the work area |
| `placement` | `'top' \| 'bottom' \| 'start' \| 'end'`, default `'bottom'`, flips on overflow |
| `step`, `total` | renders "1 of 3" |
| `title` | heading |
| default slot | body; `<os-key>` for the ⌘K chord |
| `primary-label`, `secondary-label` | the two buttons, default "Next" and "Skip" |

Events: `os-coachmark-primary`, `os-coachmark-secondary`, `os-coachmark-dismiss` (Escape). The card mounts in the top layer with `popover="manual"`, the way `<os-action-menu>` does (`src/ui/components/os-action-menu/os-action-menu.ts:37`), so windows and the dock cannot clip it. Position with `positionFlyout()` from `src/ui/util/menu-position.ts:95`, re-run on `resize` and on `subscribeWorkArea` changes. The anchor outline is a separate absolutely positioned element sized from `anchor.getBoundingClientRect()`, reading `--os-ui-accent` through a private alias (never a `--os-ui-*` declaration on `:host`, per AGENTS.md). No scrim. Reduced motion: no slide-in, no pulse on the outline.

Focus: the card takes focus on open and restores it on close; Tab cycles within the card. Escape fires dismiss.

### The tour module

`src/shell-tour/` in its own lazy bundle (Vite target `shell-tour`, URL shipped as `config.shellTourBundleUrl` from the `openstation_shell_config` array in `includes/render/assets.php:467`), following `src/workspaces/wizard.ts`, which is the in-tree precedent for a lazily loaded stepped flow.

Trigger, at the tail of boot in `src/desktop.ts` right after `void maybeShowRebrandNotice( { config } )` (line 5091):

```ts
void maybeStartShellTour( { config, windowManager } );
```

`maybeStartShellTour()` returns early when `config.seenIntros` includes `shell-tour`, when the rebrand notice or the core-update card showed this boot (two announcements on one boot reads as a broken page), when the viewport is under the mobile breakpoint, or when `apply_filters( 'openstation_show_shell_tour' )` said no server-side (shipped as `config.shellTour: false`). Otherwise it waits `MOUNT_DELAY_MS = 1200` (the rebrand notice's rationale, `src/rebrand-notice.ts:55`) and loads the bundle.

Steps:

| Step | Anchor | Completes on | "Do it for me" |
|---|---|---|---|
| 1. Open a window | the Posts dock tile (`[data-window-id="desktop-mode-posts"]` in the active rail; fall back to the first dock tile) | `HOOKS.WINDOW_OPENED` | `wp.os.openWindow( 'desktop-mode-posts' )` |
| 2. Snap it | the window just opened | `os.snap.zone-committed` (`src/hooks.ts:1290-1300`) | `windowManager.getById( id )?.applySnap( 'left' )` (`src/window/index.ts:1799`) |
| 3. Find anything | none (centered) | the palette opening; `src/palette-registry.ts:202` `openPaletteOnly()` has no hook today, so add `HOOKS.PALETTE_OPENED` there and document it | `wp.os.openPalette( <command palette id> )`, and be ready for the first-open lazy load (`src/commands/palette-assets.ts:217`) |
| Done | none | Next | closes |

Step 2 copy teaches the gesture ("Drag the window to the left edge until the preview appears") since snapping has no keyboard shortcut. Step 3 renders the chord with `<os-key>`.

Skip at any step, Escape, or Done: `POST { slug: 'shell-tour' }` to `${ config.seenIntrosUrl }/seen` through `trackedFetch` with `silent: true`, the exact call in `src/rebrand-notice.ts:71-91`. Mark seen once; a second call is harmless but wasteful.

Replay: listen for `os-intros-reset` (dispatched by `apps/os-settings/parts/features.ts:84-98`) and start the tour immediately, so "Reset what's-new dialogs" gives an instant replay instead of one on the next boot. Also add a **Take the tour** button next to it in Features that dispatches `os-shell-tour-start`; the module listens for both. The MIO action list (`apps/os-settings/parts/mio-extra-actions.ts`) gets `take_the_tour` for free if it is wired as a window action; optional.

The tour also runs when a user enables from the portal or the row action, because both land in the shell and boot normally.

## 5. Measurement on the site

`openstation_activation_within( $days )` in `stamps.php` returns `true`, `false`, or `null` (unknown, backfilled). The deactivation-feedback payload reads it into `first_enable_delay_days`, `ever_enabled` and `install_age_days`. That is the funnel for every site that deactivates: the population we most need to understand, at no extra consent.

Also expose the two site stamps and the per-user stamp read-only in the shell config (`installedAt`, `firstEnabledAt`, `enabledAt`, epoch seconds) so future in-shell logic (a "you have used this for a week, leave a review" prompt, strategy section 5) can gate on them without another round trip.

## 6. Optional: the activation ping

The strategy's indicator "sites with one enabled user within 7 days of install" across the whole install base, not only deactivators, needs one outbound request per site, and that needs its own consent. Two honest options:

- **A site-wide Extended option**, `usage_ping`, default `false`, declared as one line in `openstation_get_extended_options()` (`includes/extended-options.php:69-76`) with the flag's paragraph in the file header. It gets the admin-only REST route, the Features checkbox and the assistant action with no new plumbing. When on, `openstation_user_enabled` with `$first_on_site === true` sends `{ id, plugin_version, wp_version, php_version, locale, multisite, install_age_days }` to the same collector, endpoint `/v1/activation`, once. The nudge and the welcome dialog can offer the checkbox ("Also send an anonymous one-time signal that this site turned OpenStation on"), unchecked.
- **Not now.** Ship the stamps and the deactivation-side funnel, look at a month of data, decide whether a positive-side ping is worth a consent surface.

Recommendation: the second. Build the ping only if the deactivation data proves the never-enabled cohort is large and we need the denominator. Whatever is chosen, an opt-in ping gets its own `= External services =` block in `readme.txt`.

## Docs

- `docs/data-model.md`: three new rows (two options, one user meta) and the module matrix.
- `docs/hooks-reference.md`: `openstation_user_enabled`, `openstation_user_disabled`, `openstation_show_activation_nudge`, `openstation_show_shell_tour`, and `HOOKS.PALETTE_OPENED` if it is a JS hook.
- `docs/javascript-reference.md`: `config.shellTour`, `config.shellTourBundleUrl`, the three stamp config keys, the `os-shell-tour-start` event, and the `shell-tour` and `activation-nudge` intro slugs.
- `docs/components-reference.md`: `<os-coachmark>`.
- `includes/rest/README.md`: the seen-intros row's permission text gains the second allowlisted slug.
- `readme.txt`: nothing, unless the ping ships.

## Tests

PHPUnit:

- `tests/phpunit/tests/firstRunStamps.php`: activation writes `installed_at` once; backfill is idempotent; `openstation_ajax_save()` stamps the user once and the site once and fires `openstation_user_enabled` with `$first_on_site` true then false. Guards the stamps the funnel depends on.
- Nudge gates in the same file: Subscriber never; Administrator on `dashboard` before anyone enables, gone after `openstation_first_enabled_at` exists, gone after `activation-nudge` is seen. Guards the "stop nagging" rules.
- Migration 9 marks `shell-tour` seen for prior users and leaves new users alone. Guards "existing users do not get the tour".
- The seen-intros allowlist test gains the `activation-nudge` case.

Vitest:

- `os-coachmark.test.ts`: opens in the top layer, fires the three events, restores focus. Extend `tests/vitest/setup.ts` with the eager import if the component is lazily registered.
- `src/shell-tour/index.test.ts`: `HOOKS.WINDOW_OPENED` advances step 1; Skip marks seen exactly once; `os-intros-reset` restarts. Guards the event-driven advance and the single POST.

## Verify

On the QA wp-env (`npm run env:start`, port 8890), fresh install:

1. `wp option get openstation_installed_at`: `via: activation`. Deactivate and reactivate: unchanged.
2. Classic admin as a fresh admin: welcome dialog shows; dismiss. Dashboard shows the nudge; Plugins shows the nudge and the "Turn on OpenStation" row link. "Not now" removes the notice and it stays gone on reload. Nudge and row link both visible to a second admin who never saw the modal.
3. Click the row link: lands in the shell, enabled. `openstation_first_enabled_at` and the user's `openstation_enabled_at` now exist. Back in classic admin as the other admin: no nudge.
4. In the shell after 1.2 s: coachmark 1 on the Posts tile. Click the tile: step 2 on the new window. Drag it to the left edge: step 3. Press ⌘K: Done. Reload: no tour. Preferences → Features → Reset what's-new dialogs: tour restarts immediately. "Take the tour" does the same.
5. Escape on step 2: tour ends, reload shows nothing, `desktop_mode_seen_intros` contains `shell-tour`.
6. Upgrade path: on a site with existing enabled users, run the migration (`wp option delete desktop_mode_migration_version` then load wp-admin): those users boot with no tour; a new user gets it.
7. `prefers-reduced-motion`: no animation on the outline or the card.

Then `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test:js`, `npm run lint:php`, and the PHP suite with the tests stack started and stopped around it.

## Out of scope

- Any change to the welcome dialog's copy or gates.
- A tour for mobile layouts (`docs/mobile.md`); the gesture in step 2 does not exist there.
- The review prompt after the fifth session (strategy, section 5). It will read `openstation_enabled_at` from this plan, and gets its own plan.
- The activation ping, unless section 6 is decided the other way.
