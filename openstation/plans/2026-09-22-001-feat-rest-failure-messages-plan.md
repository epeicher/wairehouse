# Say why a request failed, everywhere

**Repo:** alcazaba-plugin (OpenStation, wp.org slug `desktop-mode`), trunk after #884
**Origin:** OPENSTA-188 / #878 (Drafts widget) and OPENSTA-189 / #884 (Notes convert) fixed the same bug twice, by hand: a request failed, the user saw one generic line, and the reason was only in the console. The survey done for #884 found the same shape across the shell. This plan is the third time, done once.
**Shape:** one PR, one review, four commits in a fixed order so the diff reads as four stages. Nothing here changes what the AI Copilot or the Agents chat show; both already surface the server's own answer.

## The problem

A survey of every user-facing request path in the shell, done on 2026-09-22, sorts them in four groups:

| How a failure reaches the user | Surfaces |
|---|---|
| Names the cause | AI Copilot chat (server message + `data.settings_tab` → "Open Preferences" button), Drafts widget suggestions (#878), Notes convert (#884) |
| Echoes the server's message, no branching | Agents chat, desktop files (via a prefix-stripping regex copied four times; ten share toasts leak the `[openstation] files REST 403:` prefix), app-runtime dispatch, `rest-trash.ts` |
| One generic string for every cause | Notes create and trash, Drafts list/trash/apply, the five data widgets, Note Pad, bulk drop on the recycle bin (counts only) |
| Silent | Notes restore and update (except 409), recycle-bin restore/purge/empty in the Trash app, folder hydration, Agents conversation list/delete, app-runtime `200` with `ok:false`, session save, widget script load |

Three facts shape the fix:

1. **The shared client already exists and is unused.** `src/core/api-client.ts` ships `createRestClient()` and a `RestError` with `status`, `code`, `data` and the server's `message`, added in the 0.8.1 refactor and imported only by its own test. Since then four bespoke error classes have grown around it (`NotesRestError`, `FilesConflictError`, `SuggestionsError`, `JobRequestError`) plus one regex, copied four times, that recovers the human part of a message from a console-shaped string.
2. **Two global behaviours already exist and should not be duplicated per surface.** Every failed tracked request settles the window's activity indicator as `failed` with "Request failed (HTTP N)." as its tooltip (`src/boot/tracked-fetch.ts`). Every 401/403 through `wp.os.fetch` accelerates the Heartbeat auth probe, so a genuinely expired session already raises Core's login modal (`src/auth-recovery/index.ts`). Per-surface "your session expired" copy is a courtesy line, not the mechanism.
3. **Toasts have no severity.** `ToastOptions` has no `type`; the PHP toast-type registry (`includes/toast-types.php`, shipped as `config.toastTypes`) is read by nothing; `docs/hooks-reference.md` documents a `wp.os.toast( id, … )` that does not exist; and the Drafts widget already passes `type: 'error'`, which is silently dropped. An error toast looks exactly like a success toast.

## What ships

One PR. After it:

- Every request that fails in the shell throws the same `RestError`, carrying status, code, data and the server's message. The console line keeps its shape.
- One function turns that error into what to say: `describeRestFailure( err, { fallback } )`. It prefers the server's own localized `WP_Error` message, then one line per cause the client can tell apart (offline, expired session, item gone, unreadable reply), then the caller's own generic fallback. A structured hint from the server (`data.settings_tab`, the shape the AI route already uses) becomes an action button rather than prose.
- A toast can carry a `type` from the registry (`success`, `warning`, `error`, `shell-error`, or a plugin's own), and an error toast reads as one.
- The silent surfaces say something, and the generic-string surfaces say why.

What does not change: the AI Copilot and Agents chat error bubbles; the activity indicator and the auth probe; the `Request failed (HTTP N)` tooltip; session save, which stays silent by design; widget script-load failures, which stay on `HOOKS.SHELL_ERROR` for the monitoring widgets.

## Design decisions

1. **Adopt `RestError`, do not write a fifth class.** `NotesRestError` becomes `RestError`; `desktop-files/rest.ts` throws `RestError` instead of `Error` with the same `message` string, so the console line is unchanged and the four prefix-stripping regexes are replaced by reading `err.serverMessage`. `FilesConflictError` and `NotesConflictError` stay: 409 carries a payload the callers act on, not a message. `JobRequestError` stays: the Agents job poller retries on it and the survey found no gap there.
2. **The mapper returns text, not a toast.** `describeRestFailure( err, { fallback } ): { message, tone, action? }`. Callers spread it into `showToast()` or an `<os-notice>`. Notes convert keeps its own richer sentences and only swaps its private `convertFailureMessage()` branches for the shared ones where they are identical. Full sentences per case, no verb templating: translators get whole strings, and the fallback is the string the surface already shows today, so a migration never loses a message it had.
3. **The server's message wins for 4xx.** A `WP_Error` message from our routes or Core's is already localized and already names the object ("Only the note owner can change it.", "Sorry, you are not allowed to do that."). The client adds a line only for what the server cannot say: the request never arrived (offline), the reply was not JSON (unreadable), the nonce died (expired session). For 5xx the server's message is usually a stack-trace fragment, so the mapper shows the fallback with the status.
4. **Structured hints, not text parsing.** The AI route's `data.settings_tab` already proves the shape: the server names where the fix lives as data, the client renders a button. Review of the PR dropped the mapper's own `settings_tab` action: its only sender is the AI route, whose only client keeps its own reader, so the branch had no production caller. It comes back with the first surface that needs it. #878's `data.reason` is provider-specific and stays local to the Drafts widget; the mapper does not learn about AI providers.
5. **Toast tone is opt-in.** `ToastOptions.type` maps through `config.toastTypes` to a `tone` attribute on `<os-toast>`; no `type` means no tone and no visual change to any existing toast. The tone paints a hairline and an icon from the palette's existing notice tokens, read through `var()` fallbacks per the `:host` rule; no new palette token, so Legacy is untouched. `$os->toast()` and the `os.shell.toast` action gain the same optional `type`. The hooks-reference entry is corrected to `showToast( { type } )`.
6. **Silence is fixed before wording.** A recycle-bin restore that fails with nothing said is worse than any generic line, so the silent surfaces are the third commit and the generic strings the fourth. Both are small once the first two exist.
7. **`<os-notice>` gets an `action` prop only if the fourth stage needs it.** The Drafts widget appends an anchor by hand today; that works. Adding a prop is cheap but it is a kit surface, and the plan does not spend a kit change on one caller.
8. **One PR, four commits.** The four stages are one change to the user (a request that fails now says why, and looks like a failure) and one contract to plugin authors (`RestError`, `showToast( { type } )`, `$os->toast( $message, $type )`). Splitting them would ship the mapper with no caller, or the tone with no error toast to wear it. The cost is one large review, roughly 30 to 35 files, held readable by keeping each commit to its stage and the console strings byte-identical so the diff of any migrated throw site is mechanical.

## The commits

### 1. One error, one mapper

- `src/core/api-client.ts`: `RestError` gains `serverMessage` (the WP message when the body had one, else `''`) so callers stop parsing `message`. `createRestClient()` throws it for a 2xx with an empty or non-JSON body too, with code `openstation_bad_response`, mirroring what notes and files each do by hand.
- New `src/core/rest-failure.ts`: `describeRestFailure()` and `isOffline( err )`. Pure, no DOM, no `wp.os` lookup except for the settings-tab action.
- Migrate the throw sites to `RestError`: `src/notes/rest.ts`, `src/desktop-files/rest.ts`, `src/desktop-files/rest-trash.ts`, `src/app-runtime/session.ts` (its dispatch failure), the Drafts widget's three fetches. Keep every console string byte-identical.
- Replace the four regex copies in `desktop-files/{trash,media-drag,media-drop-targets,media-menu-items}.ts` with `err.serverMessage`; fix the ten share-modal toasts that leak the prefix.
- Notes convert: `convertFailureMessage()` delegates to the mapper for the shared branches and keeps its Drafts-pointing line.
- Tests: one case per mapper branch in a new `tests/vitest/rest-failure.test.ts` (offline, 401/nonce, 403 with message, 404, 5xx, unreadable 2xx, settings-tab action); `core-api-client.test.ts` gains the unreadable-2xx case; existing notes and files tests keep passing unchanged, which is the proof the console line did not move.

### 2. Error toasts look like errors

- `src/toast.ts`: `ToastOptions.type?: string`; `os/toast-requested` passes it through; `showToast()` resolves it against `config.toastTypes` and sets `tone` and `icon` on `<os-toast>`.
- `<os-toast>`: `tone` prop (`positive | warning | critical | neutral`), styles reading `--os-ui-notice-*` tokens with the pre-brand literals as fallbacks. `static help` updated.
- PHP: `App\Effects::toast()` and `$os->toast( $message, $type = '' )`; `os.shell.toast` action forwards `type`.
- Tests: one vitest case that `type: 'error'` lands as `tone="critical"` and an unknown id lands as no tone; the existing `component-token-reachability` guard covers the styles.

### 3. The silent surfaces speak

- Trash app (`apps/trash/trash.os.ts`): restore, pin-to-desktop and purge failures toast with `type: 'error'`; empty-bin failure toasts instead of logging.
- Notes: Undo-restore failure toasts; a non-409 update failure toasts once per note per burst (the `phase="failed"` dot stays).
- Agents: conversation delete failure toasts; list-load failure renders "Could not load conversations." instead of "No conversations yet."
- App runtime: a `200` with `ok: false` toasts the same line as a failed dispatch.
- Not changed, with a comment saying why: session save, widget script load, folder hydration (the layer reconciles on the next change).
- Tests: extend the existing files for the trash app and notes with one failure case each.

### 4. The generic strings say why

- Notes create and trash, Drafts list/trash/apply, Note Pad, the five data widgets, WooCommerce panel, bulk drop on the recycle bin (first reason after the counts): each passes its error through the mapper with its current string as `fallback`.
- Inline widgets append the server message under their existing line; toasts replace it.
- `<os-notice action>` only if two or more of these want a link.
- No new tests unless a migration exposes a real bug; the mapper's own tests cover the branches.

### Docs, in the same PR

`docs/javascript-reference.md` (`showToast( { type } )`, and `RestError` if it is exposed on `wp.os`), `docs/hooks-reference.md` (`openstation_toast_types` rewritten around `showToast( { type } )`), `docs/app-framework.md` (`$os->toast( $message, $type )`), `docs/components-reference.md` (`<os-toast tone>`), `docs/architecture.md` (the shared client is now the one REST path).

## Risks and how they are held

- **Review size.** One PR of roughly 30 to 35 files. Held by the four-commit order, byte-identical console strings at every migrated throw site, and the mapper's tests standing on their own.
- **Bundle weight.** Pulling `api-client.ts` into the notes, files, drafts and app-runtime bundles adds the client factory (about 2 KB minified) to each. Acceptable; the alternative is keeping five copies.
- **Strings.** New sentences in stages 1 and 3; no POT regeneration in this PR, per the workflow rule.
- **Behaviour change hidden in stage 1.** Replacing the regex with `serverMessage` changes a toast only when the old message lacked the prefix, which means it was not a REST error; those already showed the raw `err.message` and keep doing so through the fallback.
- **Toast tone drift.** Default toasts are untouched; only callers that pass `type` change. The Legacy snapshot is not edited.
- **Scope creep.** The PR ends at the four lists above. A surface not in the survey table is not in this plan.

## Verification

`npm run build`, `npm run lint`, `npm run typecheck`, `npm run test:js`, `npm run lint:php`, and `Tests_OpenStation_NotesRest` plus the trash-app PHPUnit class where PHP moved. By hand on the worktree's wp-env with the OPENSTA-189 QA plugin (injects 403, unreadable 200 and off-site edit URL on the notes convert route) extended with the same three modes on the files trash route and the draft-suggestions route, checking each stage's surfaces: the toast text, the tone, and that a note or tile ends where the server left it.
