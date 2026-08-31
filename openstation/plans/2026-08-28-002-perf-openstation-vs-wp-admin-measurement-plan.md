---
title: "perf: Measuring OpenStation against classic wp-admin on openstation.blog"
type: perf
status: draft
date: 2026-08-28
---

# perf: Measuring OpenStation against classic wp-admin on openstation.blog

## Summary

A repeatable, browser-driven measurement of wall-clock loading times on the live `https://openstation.blog/wp-admin`, comparing the OpenStation desktop against classic wp-admin on the **same site, same account, same browser session**, across the same three user tasks. The baseline arm is produced by the per-user OpenStation toggle (`desktop_mode_mode` user meta), so nothing is deactivated site-wide and no other user is affected. Timings come from the shell's own documented lifecycle events (`os-window-opened` to `os-window-content-loaded`) on one side and `PerformanceNavigationTiming` on the other, paired so like is compared with like. Ten interleaved runs per arm, medians reported. The output is a results table for a blog post about the performance series that shipped in 1.1.4.

---

## Problem Frame

The 1.1.4 performance series (#661 through #692) is a large body of work with no user-facing number attached to it. The blog post needs one, and the intended claim is "OpenStation is fast, faster than wp-admin".

**That claim is true for some tasks and false for others, and the measurement has to be built to tell them apart.** Where it holds and why:

| Task | Who wins | Mechanism |
|---|---|---|
| Very first screen, cold cache | **classic wp-admin** | The shell has to boot (`desktop.min.js` is the largest single asset on the page) and only then load the first window's document. Classic loads one document. Nothing in the perf series changes that ordering. |
| Every screen after the first | **OpenStation** | The shell stays resident. A window loads a chromeless document that does not build the admin bar (#684) or the admin menu, and the window stylesheets were already fetched on first open (#661). Classic re-downloads, re-parses and re-executes the entire admin chrome on every single navigation. |
| Returning to a screen already open | **OpenStation, by a wide margin** | It is a focus, not a navigation. Roughly one frame against a full document load. |

So the honest and still very strong headline is not "OpenStation beats wp-admin", it is **"you pay for the desktop once, and after that every screen is cheaper and going back to one is instant"**. The measurement below is designed to produce exactly those three numbers, including the one where classic wins, because a post that reports only the favourable arm is the post a reader will disprove in five minutes with their own DevTools.

The secondary problem is methodological. An earlier attempt at this kind of comparison (recorded in the 2026-08-24 boot-cost plan) compared two environments running byte-identical plugin code and reported a 2.9x difference in bytes and a minute of extra wall clock, none of which was code. Any protocol that does not control cache state, service-worker state, session state and host jitter will produce a number that is mostly noise.

---

## Requirements

- R1. Measure wall-clock time on the live `openstation.blog`, not a local instance, and not server-emitted bytes.
- R2. Compare OpenStation against classic wp-admin for the **same task**, on the same site, same user account, same browser profile, same sitting.
- R3. Produce three separate numbers: cold boot, first open of a screen with the shell already up, and return to a screen already open.
- R4. Pair each OpenStation metric with a classic metric that measures a comparable moment, and state the pairing.
- R5. No site-wide deactivation and no downtime for anyone else using the blog.
- R6. Ten runs per arm per scenario, interleaved A/B/A/B, reported as medians with spread. Never a single reading.
- R7. Report TTFB as its own column so host jitter is visible rather than being attributed to the plugin.
- R8. Both cold and warm cache states, with the service-worker state explicitly controlled in each.
- R9. Every credential stays with the site owner. No password is shared to run this.
- R10. Report the arm where classic wins as prominently as the arms where OpenStation wins.

---

## Scope Boundaries

**In scope**

- Three admin screens on one live site, in one browser, on one connection.
- Time from user intent (the open call, or the navigation start) to content ready and to fully loaded.
- Cold and warm cache, with the two PWA opt-ins (shared admin-asset cache, hover prewarm) as an explicit third configuration.

**Out of scope**

- **Bytes and request counts.** `bin/boot-cost.mjs` already answers that question and answers it better. If the post wants a supporting byte figure, take it from there rather than from DevTools' footer totals.
- **Version-over-version comparison.** 1.1.3 against trunk is a different post. The Beta installer (#425) makes it possible later if wanted.
- **Lighthouse, Core Web Vitals, LCP.** LCP inside a chromeless iframe reports into the iframe's own context and is not comparable to the shell's. Navigation timings plus the shell's own lifecycle events are enough and are defensible.
- **Other browsers.** One browser, stated in the post. A cross-browser matrix multiplies the runs for no extra claim.
- **The front end.** This is entirely about `/wp-admin`.

---

## Context & Research

**The shell publishes the exact signals this needs**, both documented Stable in `docs/javascript-reference.md:120-165`, both dispatched on `document` with `detail: { windowId }`:

- `os-window-opened` fires when the open is requested.
- `os-window-content-loaded` fires when the window's content is ready. The shell removes the loading overlay and fades the content in on this transition, so it is literally the moment the user sees the screen.

**What `os-window-content-loaded` actually means for an iframe window** matters for R4. Two paths converge on the same idempotent transition (`src/window/dom.ts:699-725`):

1. The chromeless bridge posts `os-ready`, which is emitted at the very end of the bridge script (`src/chromeless-bridge.js:3614`), and the bridge is hooked on `admin_footer` (`includes/render/chromeless-bridge.php:517`). That is end-of-body-parse, **before** subresources finish.
2. The iframe element's native `load` event, which is all subresources.

Whichever fires first wins, and in practice that is `os-ready`. So `os-window-content-loaded` is a "document parsed and bridge wired" moment, roughly comparable to `domContentLoadedEventEnd`, **not** to `loadEventEnd`. Pairing it against a classic `loadEventEnd` would flatter OpenStation and would be the first thing a sceptical reader takes apart. Hence two metrics per arm, below.

**The baseline arm needs no deactivation.** `openstation_is_enabled()` reads the `desktop_mode_mode` user meta (`includes/helpers.php:58-69`), so the admin-bar toggle turns the desktop off **for one account only**. The site keeps working for everyone else.

**The per-request classic flag is a trap for multi-step scenarios.** `?desktop_mode_classic=1` does skip the shell, its assets and the body class (`includes/render/shell.php:29`, `includes/render/assets.php:77`), and it does bypass the portal redirect (`includes/portal.php:333`). But the flag is deliberately single-request: the comment at that line states that subsequent navigations inside the tab lose it and follow normal rules, which means a click from Dashboard to Posts bounces back into the desktop. Usable only if every URL is navigated to directly with the flag appended.

**The service worker will still be there** in the baseline arm. It persists until unregistered, and `src/pwa/sw-policy.ts` classifies requests by URL, not by whether the shell is running, so a warm classic run can be served from OpenStation's own admin-asset cache. This inflates the baseline, which makes the comparison conservative in the direction of our claim. That is acceptable and must be stated; the cold arm clears it anyway.

**The two PWA accelerations are opt-in and off by default**: the shared admin-asset cache (`docs/pwa.md:190`) and hover prewarm (`docs/pwa.md:163`). They must be identical across arms, or measured as their own configuration.

**One risk specific to the cold arm.** The 2026-08-27 dedicated-shell-screen plan records that on a site running the Gutenberg plugin, the shell document inherits Gutenberg's Dashboard (Beta) enqueues, taking it to 162 requests / 20.0 MB raw. If `openstation.blog` runs Gutenberg, the cold-boot arm will look considerably worse than it does on a plain site, for a reason that has nothing to do with the perf series and that a dedicated shell screen is already planned to fix.

---

## Key Technical Decisions

- **KD1. Baseline is the per-user toggle, not deactivation and not the classic flag.** Deactivation takes the desktop away from every user of the blog for the duration; the classic flag survives only one request. The user-meta toggle is per-account, instant, reversible, and leaves the server-side plugin load in place for both arms, which keeps PHP bootstrap constant across the comparison instead of adding a second variable.
- **KD2. Two metrics per arm, paired explicitly.** "Content ready" pairs `os-window-content-loaded` with `domContentLoadedEventEnd`; "fully loaded" pairs the iframe element's `load` with `loadEventEnd`. The post leads with **fully loaded**, because it is the strict, unarguable pairing, and shows content-ready as the perceived number.
- **KD3. Opens are driven with `wp.os.openWindow( id )`, not clicks.** Removes human reaction time and makes every run byte-identical in intent. The API is documented Stable (`docs/javascript-reference.md:1292`).
- **KD4. Interleave A/B/A/B, report medians.** A remote host's latency drifts over minutes; running ten of one arm then ten of the other lets that drift land entirely on one side.
- **KD5. Session state is reset before every cold run.** Session restore reopens windows, which would both slow the cold boot and pre-satisfy the revisit scenario. Every cold run starts from zero open windows.
- **KD6. Nobody's password changes hands.** Browser automation needs a **cookie session**, and a WordPress application password cannot create one: application passwords authenticate REST and XML-RPC over HTTP Basic only. The workable options are, in order of preference: (a) drive the owner's already-logged-in Chrome through the Claude in Chrome extension, where no credential is ever exposed; (b) create a throwaway WordPress user with a local password for the measurement and delete it afterwards; (c) the owner runs the harness themselves and hands over the JSON.

---

## Open Questions

- **OQ1.** Does `openstation.blog` run the Gutenberg plugin? It materially changes the cold-boot arm (see Context) and decides whether that number needs a caveat in the post.
- **OQ2.** Which three screens? Proposed: Posts list (`edit.php`), Media (`upload.php`), and a post editor (`post.php?post=<fixed id>&action=edit`). The editor is the heaviest and the one where the deferral work should show up most.
- **OQ3.** Does the post include the PWA opt-ins configuration as a third arm? It is the strongest warm result but it describes a setting most users have not enabled, so it is a separate row, never the headline.
- **OQ4.** Clean Chrome profile, or the owner's daily profile? A clean profile removes extension noise; the daily profile is what real usage looks like. Interleaving largely cancels extension overhead either way.

---

## High-Level Technical Design

### The three scenarios

| # | Scenario | OpenStation arm | Classic arm |
|---|---|---|---|
| S1 | **Cold boot** | Fresh profile, SW unregistered, storage cleared, no open windows. Navigate to `/wp-admin/`. Measure to shell `loadEventEnd`, then open the first screen and measure to its content-ready. | Fresh profile, SW unregistered, storage cleared. Navigate to `/wp-admin/edit.php`. Measure to `loadEventEnd`. |
| S2 | **First open of each screen, shell already warm** | Shell booted, no windows open. `wp.os.openWindow()` each of the three ids in a fixed order. | From the Dashboard, navigate to each of the three URLs in the same order. |
| S3 | **Return to a screen already open** | All three windows open. `wp.os.openWindow()` an existing one. Measure to next paint. | Navigate back to the same URL with a warm browser cache. Measure to `loadEventEnd`. |

S2 is the day-to-day number the post is really about. S3 is where the architectural win is largest. S1 is the arm we report honestly and lose.

### Metric pairing

| Metric | OpenStation | Classic |
|---|---|---|
| Content ready (perceived) | `os-window-opened` to `os-window-content-loaded` | navigation start to `domContentLoadedEventEnd` |
| Fully loaded (strict, headline) | `os-window-opened` to iframe element `load` | navigation start to `loadEventEnd` |
| TTFB (reported separately) | iframe document `responseStart` where available | `responseStart` |

### Harness, OpenStation arm

Pasted once into the console on the booted desktop. Uses only documented Stable surface.

```js
window.__osPerf = ( () => {
	const withTimeout = ( p, ms ) =>
		Promise.race( [
			p,
			new Promise( ( r ) => setTimeout( () => r( null ), ms ) ),
		] );

	const contentReady = ( base ) =>
		new Promise( ( resolve ) => {
			const on = ( e ) => {
				if ( ! e.detail.windowId.startsWith( base ) ) {
					return;
				}
				document.removeEventListener( 'os-window-content-loaded', on );
				resolve( performance.now() );
			};
			document.addEventListener( 'os-window-content-loaded', on );
		} );

	// S2: first open of a screen, shell already up.
	async function open( base ) {
		const ready = contentReady( base );
		const t0 = performance.now();
		wp.os.openWindow( base );

		// The window element is built synchronously by open(), so the
		// iframe exists on the next line and its `load` cannot have
		// fired yet.
		const frame = document.querySelector(
			`[id^="wp-window-${ base }"] iframe.os-window__iframe`
		);
		const loaded = frame
			? new Promise( ( r ) =>
					frame.addEventListener(
						'load',
						() => r( performance.now() ),
						{ once: true }
					)
			  )
			: Promise.resolve( null );

		const tReady = await withTimeout( ready, 30000 );
		const tLoaded = await withTimeout( loaded, 30000 );
		return {
			window: base,
			ready_ms: tReady && Math.round( tReady - t0 ),
			loaded_ms: tLoaded && Math.round( tLoaded - t0 ),
		};
	}

	// S3: return to a window that is already open.
	async function revisit( base ) {
		const t0 = performance.now();
		wp.os.openWindow( base );
		await new Promise( ( r ) =>
			requestAnimationFrame( () => requestAnimationFrame( r ) )
		);
		return { window: base, focus_ms: Math.round( performance.now() - t0 ) };
	}

	async function run( ids, fn ) {
		const rows = [];
		for ( const id of ids ) {
			rows.push( await fn( id ) );
			await new Promise( ( r ) => setTimeout( r, 1500 ) );
		}
		console.table( rows );
		return rows;
	}

	return { open, revisit, run };
} )();
```

### Harness, classic arm

Read after each navigation completes. One line, no state to carry across documents.

```js
( () => {
	const n = performance.getEntriesByType( 'navigation' )[ 0 ];
	return {
		url: location.pathname + location.search,
		ttfb: Math.round( n.responseStart ),
		dcl: Math.round( n.domContentLoadedEventEnd ),
		load: Math.round( n.loadEventEnd ),
	};
} )();
```

### Controls applied to every run

1. Same account, same browser, same profile, same network, one sitting.
2. Session reset to zero open windows before each S1 and S2 run.
3. Cold runs: service worker unregistered, storage cleared, cache disabled. Warm runs: normal cache, service worker as installed, PWA opt-ins identical across arms.
4. No other tab loading the site during a run.
5. Discard any run where TTFB deviates by more than 3x the arm's median, and say in the post how many were discarded.

---

## Implementation Units

- **U1. Access.** Settle KD6. If option (a), the site owner grants the Chrome extension permission for `openstation.blog` and confirms they are logged in.
- **U2. Fixtures.** Fix the three screen ids and URLs (OQ2), and a specific post id for the editor so both arms open the same content.
- **U3. Dry run.** One pass of each scenario in each arm to shake out the selectors, the window ids, and any auto-open behaviour that interferes.
- **U4. Collection.** Ten interleaved runs per scenario per arm. Raw JSON kept.
- **U5. Analysis.** Medians, interquartile range, discarded-run count. One table per scenario.
- **U6. Write-up.** The post, with the S1 loss stated plainly.

---

## Risk Analysis & Mitigation

| Risk | Mitigation |
|---|---|
| The headline claim does not survive the measurement. | The three scenarios are separate numbers, so a loss in S1 does not invalidate S2 and S3. If S2 also comes out unfavourable, that is a finding worth having before publishing, not after. |
| Reader reproduces it and gets different numbers. | Publish the protocol, the harness, the browser, the date, and the discard rule. Reproducibility is the point, not a threat. |
| Metric mismatch accusation (DCL against load). | KD2 pairs both metrics explicitly and leads with the strict pair. |
| Service worker inflates the classic arm. | Stated openly. It makes the comparison conservative, which is the safe direction for this claim. |
| Host jitter on a live site. | Interleaving, medians, separate TTFB column, discard rule. |
| Gutenberg inflating cold boot. | OQ1. If present, caveat the S1 number and reference the dedicated-shell-screen plan as the in-flight fix. |
| Measuring a live production site. | Read-only navigation only. No content is created, edited or deleted. The only write is the owner's own per-user toggle, flipped back at the end. |

---

## Phased Delivery

1. **Phase 1.** U1 and U2, plus OQ1 answered. Blocking.
2. **Phase 2.** U3 dry run, both arms, one pass. Confirms the harness before spending forty runs on it.
3. **Phase 3.** U4 collection and U5 analysis.
4. **Phase 4.** U6 write-up. Optionally add a byte table from `npm run perf:boot-cost` as supporting evidence.

---

## Documentation Plan

The output is a blog post, not a repo doc. Nothing in `docs/` changes. If the protocol proves reusable, the natural home for a distilled version is a section in `docs/DEVELOPMENT.md` next to the existing boot-cost section, which covers the byte side of the same question.

---

## Sources & References

- `docs/javascript-reference.md:120-165` (`os-window-content-loading` / `os-window-content-loaded` contracts), `:1292` (`wp.os.openWindow`).
- `src/window/dom.ts:699-725` (both ready paths converge on one idempotent transition), `:419` (`wp-window-<id>` element id).
- `src/chromeless-bridge.js:3614` (`os-ready` emission point), `includes/render/chromeless-bridge.php:517` (`admin_footer` hook).
- `includes/helpers.php:58-69` (`desktop_mode_mode`, per-user enable).
- `includes/core/routing.php:325`, `includes/portal.php:333` (classic flag semantics, single-request).
- `src/pwa/sw-policy.ts` (URL-based classification), `docs/pwa.md:163,190` (prewarm and admin-asset cache opt-ins).
- `docs/plans/2026-08-24-001-ci-boot-cost-regression-table-plan.md` (why uncontrolled comparisons fail).
- `docs/plans/2026-08-27-001-perf-dedicated-shell-screen-plan.md` (Gutenberg inheritance on the shell document).
- Perf series: #661, #664, #668, #669, #671, #676, #678, #682, #683, #684, #688, #689, #692.
