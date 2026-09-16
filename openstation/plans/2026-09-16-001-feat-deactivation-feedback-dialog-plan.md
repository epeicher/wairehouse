# Deactivation feedback dialog

**Repo:** alcazaba-plugin (OpenStation, wp.org slug `desktop-mode`), trunk at 1.1.9
**Origin:** [Marketing strategy, section 6](../marketing/2026-09-16-installs-north-star-marketing-strategy.md): "We cannot fix churn we cannot see. The single most important instrument in the plan."
**Pairs with:** [First-run activation](2026-09-16-002-feat-first-run-activation-plan.md), which adds the install stamp this payload reads. Either can ship first; this plan degrades to `null` where the stamp is absent.

## The problem

Active installs fall by about 75 sites a week and nothing in the product records why a site leaves. Both deactivation paths are pure Core today: classic `plugins.php` runs `deactivate_plugins()` with no OpenStation code in front of it, and the native Plugins app drives Core's REST plugins controller in-process (`apps/plugins/plugins.os.php:133`). The only OpenStation hook on either path is `deactivated_plugin`, which fires after the fact and is already used for the content-changes log (`includes/content-changes.php:632`).

## What ships

When a site admin deactivates OpenStation, a dialog asks one optional question before the deactivation proceeds:

> **Before you go, what didn't work?**
> ( ) It broke something
> ( ) It was too slow
> ( ) I didn't understand it
> ( ) It's not for me
> ( ) Something else
> [ free text, optional, "Which page or plugin?" placeholder for the first option ]
> What we send: your answer, the plugin, WordPress and PHP versions, your site language, and how long OpenStation was installed. Nothing that identifies you or your site.
> [ Skip and deactivate ]  [ Send and deactivate ]

Nothing is sent unless the admin clicks **Send**. Both buttons deactivate. Submissions are forwarded server-side to a collector we run, and land in a table we read weekly.

Consent is per submission, which is the opt-in wp.org's guideline 7 requires. There is no background ping in this plan.

## Design decisions

1. **One dialog implementation, plain DOM, in its own bundle.** The dialog has to render on classic `plugins.php` with no OpenStation shell loaded, where the `<os-*>` kit does not exist. `includes/welcome-dialog.php:14-18` already documents that constraint and hand-rolls its markup for the same reason. One renderer that works in both contexts beats two. This is a deliberate exception to the "use os-* components" rule, and the module header says so.
2. **The browser posts to the site, the site forwards to the collector.** Not browser-direct. Three reasons: ad blockers routinely drop third-party telemetry hosts, so client-direct posts would silently vanish for a biased slice of users; a server-side hop means the collector sees the server's IP, not the person's, which keeps the disclosure simple; and the payload shape is assembled in PHP where a host can filter it (`openstation_deactivation_feedback_payload`) or switch the feature off (`openstation_deactivation_feedback_enabled`).
3. **The forward is synchronous, short, and best-effort.** A cron job cannot do it: the plugin is about to be deactivated and its cron callbacks will not exist. So the REST handler forwards inline with `timeout => 3`, returns 200 whatever happens, and the browser proceeds to deactivate on any response. Worst case the admin waits three seconds once.
4. **Anonymous means no site id.** No hash of the home URL, no install UUID. A random per-submission id is enough to dedupe retries. Deliberate: it makes the disclosure a single honest sentence, and dedupe across submissions is not something the weekly read needs.
5. **Five reasons, as specified.** A sixth, "Just testing / temporary", would cut noise from staging sites. Not added here; revisit after the first month of data.

## The payload

```json
{
  "id": "6d1f…",                    // wp_generate_uuid4(), per submission
  "reason": "broke_something",      // one of the five slugs, or "other"
  "details": "Elementor editor went blank",   // sanitize_textarea_field, max 1000 chars, optional
  "plugin_version": "1.1.9",
  "wp_version": "7.1",
  "php_version": "8.3",             // major.minor only
  "locale": "es_ES",
  "multisite": false,
  "install_age_days": 12,           // from openstation_installed_at, null if absent
  "ever_enabled": true,             // any user has desktop_mode_mode meta (openstation_users_with_prior_desktop_use())
  "enabled_user_count": 2,          // bucketed on the collector, exact here
  "first_enable_delay_days": 0,     // from openstation_first_enabled_at, null if absent
  "deactivator_enabled": false,     // openstation_is_enabled() for the current user
  "active_plugins": 23,             // count only, no slugs
  "context": "classic"              // "classic" | "chromeless" | "app"
}
```

The last six fields are what turns this from a complaint box into the activation funnel the strategy asks for. `ever_enabled: false` on a deactivation is hypothesis 2 ("installed for a team, never turned on anywhere") confirmed for that site.

## Server side: `includes/feedback/`

New module, loaded unconditionally from `desktop-mode.php` right after `includes/network/bootstrap.php` (line 197), before `pwa.php`, so the REST route registers on REST requests:

```php
require_once OPENSTATION_DIR . 'includes/feedback/bootstrap.php';
```

Files:

- `bootstrap.php`: requires the two below; defines `OPENSTATION_FEEDBACK_ENDPOINT` (the collector URL) and the `openstation_deactivation_feedback_enabled()` helper (`apply_filters( 'openstation_deactivation_feedback_enabled', true )`).
- `deactivation.php`: the screen hook, the payload builder, the forwarder.
- `rest.php`: the route.

### The screen hook

Enqueue the bundle on `plugins.php` in every admin context, classic and chromeless, and in the network admin. Hypothesis 2 says the sites we most need to hear from never opened OpenStation, so the classic screen is the primary surface, not the fallback.

```php
add_action( 'admin_enqueue_scripts', 'openstation_feedback_enqueue_deactivation_dialog' );

function openstation_feedback_enqueue_deactivation_dialog( $hook_suffix ) {
	if ( 'plugins.php' !== $hook_suffix || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	if ( ! openstation_deactivation_feedback_enabled() ) {
		return;
	}
	wp_enqueue_script( 'os-deactivation-feedback' );   // registered in includes/assets.php next to os-iframe-bridge (line 384)
	wp_enqueue_style( 'os-deactivation-feedback' );
	wp_add_inline_script( 'os-deactivation-feedback', 'window.openStationDeactivationFeedback = ' . wp_json_encode( array(
		'plugin'    => plugin_basename( OPENSTATION_FILE ),
		'restUrl'   => rest_url( 'desktop-mode/v1/feedback/deactivation' ),
		'restNonce' => wp_create_nonce( 'wp_rest' ),
		'context'   => openstation_is_chromeless_request() ? 'chromeless' : 'classic',
		'i18n'      => array( /* the strings above, translated */ ),
	) ) . ';', 'before' );
}
```

`wp_enqueue_script` on `plugins.php` inside a chromeless iframe survives `includes/render/chromeless-trim.php` only if the handle is allowlisted there. Check the trim list and add the handle; the iframe bridge handle is the precedent.

### The route

Modeled on `includes/seen-intros.php:159-233`, the closest existing POST-with-schema route.

```php
register_rest_route( 'desktop-mode/v1', '/feedback/deactivation', array(
	'methods'             => WP_REST_Server::CREATABLE,
	'callback'            => 'openstation_rest_deactivation_feedback',
	'permission_callback' => 'openstation_rest_deactivation_feedback_permission',
	'args'                => array(
		'reason'  => array( 'required' => true, 'type' => 'string', 'enum' => array( 'broke_something', 'too_slow', 'didnt_understand', 'not_for_me', 'other' ) ),
		'details' => array( 'type' => 'string', 'default' => '' ),
		'context' => array( 'type' => 'string', 'enum' => array( 'classic', 'chromeless', 'app' ), 'default' => 'classic' ),
	),
) );
```

Permission is `current_user_can( 'activate_plugins' )` plus the feature flag, **not** `openstation_rest_require_enabled()`: the person deactivating usually does not have OpenStation on, and that is the whole point. The `includes/rest/README.md` row reads "`activate_plugins` + `openstation_deactivation_feedback_enabled()`; no object-level checks, the route stores nothing on the site".

The handler builds the payload, runs it through `apply_filters( 'openstation_deactivation_feedback_payload', $payload )` (an empty array suppresses the send), forwards, and returns `{ sent: bool }`. It never returns an error for a failed forward.

### The forwarder

Copy the shape of `openstation_favicon_request_args()` (`includes/desktop-files/favicon.php:150-160`) for the request args:

```php
$response = wp_remote_post( apply_filters( 'openstation_deactivation_feedback_endpoint', OPENSTATION_FEEDBACK_ENDPOINT ), array(
	'timeout'     => 3,
	'redirection' => 0,
	'user-agent'  => 'WP OpenStation feedback/' . OPENSTATION_VERSION,
	'headers'     => array( 'Content-Type' => 'application/json' ),
	'body'        => wp_json_encode( $payload ),
) );
return ! is_wp_error( $response ) && 2 === (int) floor( wp_remote_retrieve_response_code( $response ) / 100 );
```

`wp_remote_post`, not `wp_safe_remote_post`: the destination is a constant we own, and the filter is for hosts that want to point it at their own collector. phpcs has no rule on `wp_remote_*`; `WordPress.WP.AlternativeFunctions` forbids raw cURL, which is fine.

## Client side: `src/deactivation-feedback/`

New Vite target `deactivation-feedback` in `package.json` and `vite.config.js`, building to `assets/js/deactivation-feedback[.min].js`. Styles in `assets/css/deactivation-feedback.css`, scoped under `.os-deactivation-feedback`, following `assets/css/announce.css` for the scrim and card.

`index.ts` exports two things and installs one listener:

```ts
export interface DeactivationFeedbackConfig { plugin: string; restUrl: string; restNonce: string; context: 'classic' | 'chromeless' | 'app'; i18n: Record< string, string > }

/** Opens the dialog and resolves when the user picks either button. Sends only on "Send". */
export function askDeactivationFeedback( config: DeactivationFeedbackConfig ): Promise< void >;

/** Classic/chromeless plugins.php: intercepts the Deactivate link on our own row. */
export function interceptPluginsScreen( config: DeactivationFeedbackConfig ): void;
```

`interceptPluginsScreen()` finds `tr[data-plugin="${ config.plugin }"] .deactivate a`, captures its click, calls `askDeactivationFeedback()`, then assigns `location.href` to the original `href`. Bulk deactivation with OpenStation checked is left alone in this iteration (see Out of scope). The module self-runs the interceptor when `window.openStationDeactivationFeedback` is present at load, and publishes `askDeactivationFeedback` on `window.wp.os.deactivationFeedback` when the shell is present, so the Plugins app can call it.

The dialog:

- `role="dialog" aria-modal="true"`, focus trapped, Escape equals Skip, focus restored afterwards. Copy the trap from `src/rebrand-notice.ts:58` (`FOCUSABLE`), not from `<os-modal>`, since the kit is absent on classic screens.
- A `div[role=radiogroup]` of native radios, the pattern `src/bug-report/index.ts:120-155` already uses.
- Textarea with `maxlength="1000"`.
- The send uses `trackedFetch` (`src/tracked-fetch.ts`) with `silent: true`; it falls back to native fetch before boot, which is the classic-screen case. Wait for the response with a 4-second client timeout, then proceed regardless.
- `prefers-reduced-motion` respected on the scrim fade.

### The native Plugins app

`apps/plugins/parts/mutations.ts:58-69` `deactivatePlugin()` gains one branch: when `host.rest.isOpenStationSelf( row.plugin )`, load the bundle (URL from the app config, next to `selfPluginFile` at `apps/plugins/plugins.os.php:269-277`), `await askDeactivationFeedback( { …, context: 'app' } )`, then dispatch as today. Bulk deactivation in `apps/plugins/parts/actions.ts:352-378` does the same when the selection includes self. The cards view, the 1.1.9 table view, the flyout detail and the bulk bar all route through these two functions, so no other change is needed.

## The collector

A Cloudflare Worker with a D1 table, at a subdomain we control (proposal: `feedback.openstation.me`). It is the smallest thing that gives "a table we read weekly":

```sql
CREATE TABLE deactivations (
  id TEXT PRIMARY KEY,           -- the submission uuid; INSERT OR IGNORE dedupes retries
  received_at TEXT NOT NULL,     -- ISO 8601, server clock
  reason TEXT NOT NULL,
  details TEXT,
  plugin_version TEXT, wp_version TEXT, php_version TEXT, locale TEXT,
  multisite INTEGER, install_age_days INTEGER, ever_enabled INTEGER,
  enabled_user_bucket TEXT,      -- "0" | "1" | "2-5" | "6+" (bucketed on ingest)
  first_enable_delay_days INTEGER, deactivator_enabled INTEGER,
  active_plugins_bucket TEXT,    -- "<10" | "10-29" | "30+"
  context TEXT
);
```

The Worker accepts `POST /v1/deactivation` with a JSON body, validates the enum fields, buckets the two counts, drops anything else, and never logs the request IP. Rate-limit by IP in memory (Workers KV not needed) to blunt abuse. A `GET /v1/deactivation.csv` behind a bearer token is the weekly read; the marketing metrics script pulls it into the dashboard.

Alternative considered: a REST endpoint plus custom table on openstation.blog. Works, but puts an unauthenticated write endpoint on the marketing site and couples uptime of the feedback pipe to a WordPress host. The Worker is the recommendation; the endpoint constant is the only thing the plugin knows either way.

**Decision needed before shipping:** the hostname, and who owns the Cloudflare account it lives in.

## Docs and disclosure

- `readme.txt`, `= External services =`: a new `**Deactivation feedback**` block in the four-label style used for the AI Assistant (lines 73-82): what is sent (the list above, "nothing that identifies you or your site"), when (only when you click Send in the dialog shown on deactivation), why (to learn what to fix), who provides the service (Automattic, with the privacy policy link). Update the FAQ answer at line 125-127 so "No." stays truthful ("…and an optional, one-click feedback form when you deactivate.").
- `includes/rest/README.md`: the route row.
- `docs/hooks-reference.md`: `openstation_deactivation_feedback_enabled`, `openstation_deactivation_feedback_payload`, `openstation_deactivation_feedback_endpoint`.
- `docs/javascript-reference.md`: `wp.os.deactivationFeedback.ask()`.
- `docs/data-model.md`: nothing new is stored on the site by this plan. Say so in the module header so nobody goes looking.
- `docs/architecture.md`: one paragraph under outbound requests.

## Tests

Only what would catch a real bug (AGENTS.md, "Add a test only when it would catch a real bug").

PHPUnit, `tests/phpunit/tests/deactivationFeedback.php`, modeled on `openStationDefaultWindow.php`:

- A Subscriber gets 403; an Administrator gets 200. Guards the gate, which is not the usual `openstation_rest_require_enabled()`.
- The forward is mocked with `pre_http_request`; the test asserts the payload has exactly the documented keys, no `home_url`, no user data, `details` truncated to 1000 chars. Guards the anonymity promise in the readme.
- Returning an empty array from `openstation_deactivation_feedback_payload` results in no HTTP call. Guards the host opt-out.

Vitest, `src/deactivation-feedback/index.test.ts`:

- Skip does not fetch and navigates; Send fetches once and navigates even when the fetch rejects. Guards "nothing is sent unless Send" and "deactivation always proceeds".

## Verify

On the QA wp-env (`npm run env:start`, port 8890):

1. Classic admin, OpenStation off for the user: Plugins, Deactivate on the OpenStation row. Dialog appears. Skip deactivates without a request in the Network tab. Reactivate, Deactivate again, pick a reason, Send: one `POST /wp-json/desktop-mode/v1/feedback/deactivation`, then the deactivation redirect.
2. Inside OpenStation with `nativePluginsEnabled` off: the Plugins dock tile opens the chromeless `plugins.php`; same behaviour inside the iframe, then `src/plugin-presence.ts` exits to classic admin as it does today.
3. `nativePluginsEnabled` on: the native Plugins app, cards view and table view, row action and bulk. Same dialog, `context: "app"`.
4. Point `OPENSTATION_FEEDBACK_ENDPOINT` at a local Worker (`wrangler dev`) and confirm one row per Send with the bucketed columns.
5. `add_filter( 'openstation_deactivation_feedback_enabled', '__return_false' )`: no script on the screen, route returns 403.
6. Multisite (`npm run test:php:multisite` for the suite; manual on a network install): network admin Plugins page shows the dialog too.

Then `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test:js`, `npm run lint:php`, and the PHP suite with the tests stack started and stopped around it.

## Out of scope

- Bulk deactivation from classic `plugins.php` with OpenStation among the checked rows. It is rare, the interception is a form-submit hook, and it can follow once the single-row path has data.
- An uninstall hook. The plugin has none today (a real gap: options, user meta and two table sets survive uninstall), and it is a separate change.
- Any background or install-time ping. See the first-run plan for why that needs its own consent surface.
- Reading the data: the marketing metrics pipeline (strategy, section 7) consumes the CSV; this plan ends at the table.
