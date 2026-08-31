# Studio: Sentry triage plan (guardian rotation, 2026-08-31)

Status: proposed, nothing implemented. Findings come from a review of the
`a8c/studio` Sentry project over the 14 days ending 2026-08-31. No Linear
issues opened yet — this document is the backlog.

Ordered by expected impact, not by event count. Items 1 and 3 are the ones
worth pulling into a release; 2 and 4 are small, well-understood fixes; 5 is
recorded so it stops getting re-triaged from scratch.

## Baseline for the window

Total error events by OS, 14 days to 2026-08-31 (`event.type:error`):

| OS | Events | Unique users |
|---|---|---|
| Windows | 15,990 | 4,012 |
| macOS | 3,954 | 1,212 |
| Ubuntu Linux | 1,130 | 81 |
| Debian / Fedora / Arch | 56 | 13 |

Same window, by release:

| Release | Events | Unique users |
|---|---|---|
| studio@1.18.0 | 10,102 | 2,747 |
| studio@1.19.0 | 5,397 | 1,483 |
| studio@1.20.0 | 1,999 | 708 |
| studio@1.17.0 | 1,896 | 597 |

Note the shape of that second table — it is the reason item 1 is ranked first.
Unique-user counts cannot be summed across rows (a user who upgrades appears
in two), so treat each row independently.

**Nothing new arrived with 1.20.0.** Every issue whose `firstRelease` is
`studio@1.20.0` is 1–3 events from a single user, and they are environment
failures rather than regressions: `EBUSY`/`ENOTEMPTY`/`EPERM` on Windows site
paths, blueprint `InstallPluginStep` failing behind flaky networks to
github.com, `ENOSPC`, a PHP binary install that timed out. Worth a periodic
skim for a pattern, not worth a fix each.

---

## 1. Windows auto-update is failing for thousands of users

**Evidence.** Six issues, **9,490 events / 3,322 unique users** in 14 days —
about 45% of all error volume in the project — and 100% of them on Windows.

| Issue | Signature | Reading |
|---|---|---|
| [STUDIO-W6](https://a8c.sentry.io/issues/STUDIO-W6) | `Error: Invalid result:` at `AutoUpdater.checkForUpdates` | Squirrel got a response it could not parse. Message body is empty. |
| [STUDIO-65F](https://a8c.sentry.io/issues/STUDIO-65F) | `Command failed: 4294967295` at `ChildProcess.?` | `Update.exe` exited -1 (0xFFFFFFFF). Seer rates actionability "super_low" — i.e. no stack to work with. |
| [STUDIO-EV](https://a8c.sentry.io/issues/STUDIO-EV) | same, culprit `Squirrel.SingleGlobalInstance..ctor(String key, TimeSpan timeOut)` | Two Squirrel instances contending for the global lock; one times out. |
| [STUDIO-FD](https://a8c.sentry.io/issues/STUDIO-FD) | same, culprit `System.Net.HttpWebRequest.EndGetResponse` | Network failure fetching the update payload. |
| [STUDIO-ACK](https://a8c.sentry.io/issues/STUDIO-ACK) | `TypeError: Session can only be received when app is ready` | 23,619 occurrences lifetime. Sample events carry `build_type: "windows-store"`. |
| [STUDIO-8D6](https://a8c.sentry.io/issues/STUDIO-8D6) | `Error: Can not find Squirrel` at `setupUpdates(dist.main:index)` | Same root as ACK. |

**Confirmed root cause for ACK and 8D6.** MSIX / Microsoft Store builds update
through the Store, never through Squirrel. But `setupUpdates()` in
`apps/studio/src/updates.ts:63` branches only on `process.platform === 'linux'`
before reaching `autoUpdater.setFeedURL(...)` and `autoUpdater.checkForUpdates()`.
There is no MSIX gate anywhere in the repo — grepping `windows-store`, `msix`,
`buildType` across `apps/` and `packages/` returns nothing relevant. So Store
builds run the Squirrel path on every launch and fail on every launch. Studio
does ship Windows MSIX (see `AGENTS.md`, "Windows (x64/ARM64 MSIX)").

**Change.** Electron already exposes the flag we need:
`process.windowsStore` is `true` for MSIX/AppX packages and `undefined`
otherwise (`electron.d.ts`, `NodeJS.Process.windowsStore`). It corresponds
exactly to the `build_type: "windows-store"` context Sentry is reporting.
Add an early return next to the existing Linux branch:

```ts
if ( process.windowsStore ) {
    // MSIX/Store builds update through the Microsoft Store; Squirrel is not
    // present and every call below throws.
    updaterState = 'done';
    return;
}
```

Check the same flag in `manualCheckForUpdates()` and in the
`autoUpdater.quitAndInstall()` call sites (`menu.ts:277`, `updates.ts:287`,
`updates.ts:470`) so the "Check for updates" menu item and the restart prompt
do not offer an action that cannot work there. Decide what the menu item
should do instead — most likely hide it, or deep-link to the Store listing.

**Change, second half (W6 / 65F / EV / FD).** These are Squirrel-side and need
their own investigation; do not assume the MSIX gate fixes them.

- W6 is the highest-value one: an unparseable response from
  `https://public-api.wordpress.com/wpcom/v2/studio-app/updates`. Capture what
  the endpoint actually returns for Windows for each `studioArch` and each
  `version` in `buildUpdateFeedUrl()` (`updates.ts:32`), including versions old
  enough that the server may answer differently. An empty 200 is the usual
  cause of Electron's `Invalid result:`.
- EV (lock contention) suggests two update checks racing. `setupUpdates()`
  fires one on launch, `queueUpdateCheck()` schedules more, and
  `manualCheckForUpdates()` can fire another; there is no guard that an
  update check is already in flight beyond `updaterState`. Worth confirming
  whether `updaterState` actually gates the manual path.
- FD is network failure. Probably not fixable, but it should not be a Sentry
  error — see the tradeoff below.

**Tradeoff / risk.** The MSIX gate is low-risk and mechanical. The reporting
change is where judgement is needed: `autoUpdater.on('error')` currently
`Sentry.captureException(err)`s everything except `-1009`/`-1005`
(`updates.ts:114-131`). Transient network failures on a background update poll
are not defects and are drowning the project's signal. Extending that filter —
or downgrading these to warnings — will make the dashboard usable, but do it
*after* W6 is understood, not before, or the fix removes the evidence.

**Open question, needs data we do not have in Sentry.** Two weeks after 1.20.0
shipped, 1.18.0 still accounts for the most error-reporting users (2,747 vs
708). Error-user counts are not install counts, so this is not evidence of a
stalled rollout on its own — but "the update path is failing for 3.3k Windows
users" and "users appear to be two releases behind" are suggestive together.
Check actual version distribution in Tracks before drawing a conclusion. If
adoption really is stalled, this item is considerably more urgent than its
event count implies.

**Verify.** Install an MSIX build, launch, confirm no Squirrel error reaches
Sentry and that `updaterState` ends as `done`. Then confirm the non-Store
Windows path still updates normally — the existing tests in
`apps/studio/src/tests/updates.test.ts` cover `setupUpdates()`'s listener
registration and should be extended with a `process.windowsStore` case.

---

## 2. Site database contents are being sent to Sentry

**Evidence.** [STUDIO-GZR](https://a8c.sentry.io/issues/STUDIO-GZR) — one
event, one user, and the issue title is a paragraph of a WordPress site's post
content about Batman films. The error is
`Database import failed: Error: Could not execute statement: INSERT INTO
wp_134773165_options (...) VALUES (...)` followed by hundreds of raw rows. The
event is tagged with `wpcom.user.id`, so it is attributable to a person.

**Root cause.** `apps/cli/lib/import-export/import/importers/importer.ts:139`:

```ts
throw new LoggerError(
    sprintf( __( 'Database import failed: %s' ), stderr ),
    undefined,
    'database_import'
);
```

`stderr` is the raw output of `wp sqlite import`, and the sqlite driver echoes
the entire failing INSERT statement — every column value in it. That string
becomes the exception message and ships to Sentry verbatim.

**Why this matters more than one event suggests.** In this instance the payload
was public blog content. The same code path will ship whatever happens to be in
the failing table. `wp_options` routinely holds SMTP passwords, plugin API
keys, license keys, and OAuth tokens. There is no filtering between the
importer and Sentry.

**Change.** Stop putting `stderr` in the exception message. Two parts:

1. Throw a stable, content-free message (`'Database import failed'` plus the
   `database_import` code that already exists), so grouping works and no row
   data leaves the machine.
2. Keep the detail where it is useful: the full `stderr` already goes to the
   local log via the `console.error` at line 134, which is what
   `sync-operations-slice.ts:783` points the user at ("provide details from the
   logs below"). That is the right place for it.

If a truncated hint in the exception is wanted for triage, extract only the
sqlite error class (e.g. `UNIQUE constraint failed`, `no such table`) with a
whitelist regex — never a slice of the statement, which is exactly where the
values live.

**Also fix the symptom in Sentry.** Every distinct import failure currently
becomes its own issue named after a user's content. Once the message is stable
these collapse into one group. Consider a `beforeSend` scrub as defence in
depth, but the fix belongs at the throw site.

**Verify.** Reproduce with a deliberately malformed SQL dump; confirm the
Sentry event title is the stable string, the local log still has the full
stderr, and the existing tests in `apps/cli/commands/tests/import.test.ts`
(which assert on `'Database import failed: x'` and `'Database import failed'`)
are updated to match the new contract.

---

## 3. Sync silently drops WordPress.com sites

**Evidence.** [STUDIO-BMX](https://a8c.sentry.io/issues/STUDIO-BMX) —
16 users / 155 events in the 14-day window; 49 users / 1,537 events lifetime
since 2026-04-13. The ZodError is always the same shape:

```
{ "expected": "number", "code": "invalid_type", "received": "NaN",
  "path": [ "plan", "product_id" ] }
```

**Root cause.** `packages/common/types/sync.ts:47` declares
`product_id: z.coerce.number()` as a required field. The API returns something
non-numeric for some accounts, `z.coerce.number()` yields `NaN`, and the parse
fails. `transformSitesResponse` (`packages/common/lib/sync/transform-sites.ts:45-51`)
catches per-site, calls `onParseError`, and `return acc` — **dropping the
entire site**. The user sees a site they own simply missing from the Sync list,
with no error surfaced in the UI.

There is already a comment two fields up in the same schema warning about this
exact failure mode ("silently drop every Simple site from the synced-sites
list"), so the class of bug is known.

**Change.** `product_id` is never read on this path. Grepping `product_id`
across `apps/` and `packages/` finds only the schema, three test fixtures, and
`apps/cli/ai/tools/wpcom-request.ts:44` — which reads a raw API response, not
this schema. `transformSingleSiteResponse` uses `plan?.product_name_short` and
nothing else. Make the field optional:

```ts
product_id: z.coerce.number().optional(),
```

Then audit the rest of the schema for the same trap. Every field that is
required-and-strict but unread is a site that can vanish from the list for a
reason no one will ever debug from the UI. `product_name_short` and
`product_slug` are both required today and both should be reviewed on the same
pass.

**Consider separately.** A site dropped by a parse error is invisible. Whether
`onParseError` should also surface something to the user (a "some sites could
not be loaded" affordance) is a product call worth raising, not something to
decide in this fix.

**Verify.** Unit test in `packages/common/lib/sync/tests/transform-sites.test.ts`
with a fixture whose `plan.product_id` is `""`/`null`/absent, asserting the
site still appears in the output.

---

## 4. Unhandled main-process rejection when a window closes mid-load

**Evidence.** [STUDIO-9KY](https://a8c.sentry.io/issues/STUDIO-9KY) —
`TypeError: Object has been destroyed`, culprit `loadThemeDetails`,
120 users / 184 events in 14 days, 652 users lifetime, still firing on 1.20.0.
`mechanism: auto.node.onunhandledrejection`, `handled: no`.

**Root cause.** `loadThemeDetails` (`apps/studio/src/ipc-handlers.ts:1600`)
calls `BrowserWindow.fromWebContents( event.sender )` at line 1611. If the
window has closed while the site server was starting, `event.sender` is already
destroyed and the property access throws. It is invoked as a floating promise
with no `.catch()` at two call sites — `ipc-handlers.ts:885` (after site
creation) and `ipc-handlers.ts:1148` — so the rejection escapes to the process
handler.

Note that `sendIpcEventToRendererWithWindow` (`ipc-utils.ts:108`) *already*
guards `isDestroyed()` on both window and webContents, so the guard is missing
one level up, at `fromWebContents` itself.

**Change.** Two parts, both needed:

1. In `loadThemeDetails`, return early if `event.sender.isDestroyed()` before
   touching `BrowserWindow.fromWebContents`. The function's work is pointless
   with no window to notify.
2. Give the floating `void loadThemeDetails( event, ... )` calls at lines 885
   and 1148 real `.catch()` handlers — the same applies to the adjacent
   `void loadSiteIcon(...)` and `void captureSiteThumbnail(...)` calls
   (`:1098`, `:1610`), which have the same shape.

**Confirm before implementing.** The minified stack also contains a `Session.?`
frame and a `startServer` frame, and `captureSiteThumbnail` opens an offscreen
`BrowserWindow` via `server.updateCachedThumbnail()`. `captureSiteThumbnail`
has its own try/catch around the capture, but the
`sendIpcEventToRenderer( 'thumbnail-loading' )` call above it
(`capture-site-thumbnail.ts:18`) is outside it. Reproduce by closing the window
during site creation and check which call actually throws before assuming it is
`fromWebContents` — the fix is cheap either way, but the guard needs to go in
the right place.

**Verify.** Create a site and close the window before the theme details resolve;
confirm no unhandled rejection. Add a test alongside the existing
`describe( 'loadThemeDetails' )` block in
`apps/studio/src/tests/ipc-handlers.test.ts:291` with a destroyed sender.

---

## 5. Known and accepted: two clusters not worth acting on yet

Recorded so they are not re-investigated at every rotation.

**Linux: fatal crash writing to a closed stdout.**
[STUDIO-DWZ](https://a8c.sentry.io/issues/STUDIO-DWZ) (`write EPIPE`, 1,047
occurrences lifetime / 4 users), [STUDIO-FXK](https://a8c.sentry.io/issues/STUDIO-FXK)
(`EPIPE: broken pipe, write`), [STUDIO-GY4](https://a8c.sentry.io/issues/STUDIO-GY4)
(`EBADF: bad file descriptor, write`). All three are `level: fatal`,
`handled: no`, and all three stack through `@sentry/core`'s `debug-logger.js`
into `console.log` — the main process writing to stdio that no longer exists,
typically because Studio was launched from a terminal that has since closed.
GY4 was 126 events from one user inside 10 seconds: a crash loop.

Small blast radius (a handful of users), but it is a hard crash of the main
process caused entirely by logging. If it is ever picked up, the fix is an
error handler on `process.stdout`/`process.stderr` rather than anything in
Studio's own code paths.

**macOS: native renderer crash.**
[STUDIO-7F8](https://a8c.sentry.io/issues/STUDIO-7F8) — `__pthread_kill`,
86 users / 272 events in 14 days, 204 users lifetime, steady across releases
rather than spiking. Minidump annotations are the interesting part:
`"Failed to initialize sandbox."` on `libsystem_c.dylib` and
`"SeatbeltExec: buffer length read failed: Bad file descriptor"` on the
renderer helper. Chromium sandbox initialisation failing at launch. Likely an
Electron-level issue rather than ours; revisit if it climbs, or if it turns out
to share a root cause with the file-descriptor failures above.

---

## Suggested sequencing

1. **Item 2** (data leak) first. It is a small, self-contained change and it is
   the only finding with a privacy dimension.
2. **Item 1's MSIX gate** next — mechanical, and it removes roughly a fifth of
   the project's event volume, which makes everything after it easier to see.
3. **Items 3 and 4** — both are small fixes with clear tests.
4. **Item 1's Squirrel investigation** (W6 especially), once the noise is down
   and the Tracks version-distribution question has an answer.
5. Re-run this triage afterwards. Half the value here was that the top of the
   dashboard was occupied by one theme; it will look different once that theme
   is gone.
