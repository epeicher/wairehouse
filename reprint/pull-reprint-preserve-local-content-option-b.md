# Option B — Preserve local `wp-content` on a first pull, without changing reprint

> Design sketch for WordPress Studio (`studio pull-reprint`). Describes the
> **Studio-only** approach to stopping a first pull from deleting locally
> installed plugins, themes and uploads — no reprint change, no phar bump.

> **ℹ️ Status — not the implemented route.**
> **Option A** (a merge-aware flatten inside reprint, behind a new
> `--preserve-local-content` flag) was implemented and validated end-to-end
> instead. This document is retained as the alternative that keeps the fix
> entirely inside Studio — useful if a reprint release is ever the blocker, or
> as a stopgap on a release branch.

## Context

`studio pull-reprint --path <site>` pulls a remote WordPress site onto an
**existing** local Studio site. Two behaviours were confirmed by testing:

- Pulling onto a **new** Studio site → locally installed plugins are **deleted**.
- **Incrementally** pulling onto an already-pulled site → plugins are **kept**.

### Why the first pull deletes

Studio assembles the site with reprint's `flat-docroot`, which turns the raw
download into a flat docroot made of symlinks. `--force` is passed **only on the
first pull** — its documented purpose is to overwrite the blank WordPress install
that `studio create` produced:

```
// apps/cli/commands/pull-reprint.ts
'flat-docroot', '-',
`--flatten-to=${ metadata.sitePath }`,
...( force ? [ '--force' ] : [] ),
```

A `studio create` site has a **real** `wp-content` directory. For the common
WP Cloud layout, `flat-docroot` wants `wp-content` to be a single symlink into
the raw pull directory, so `flatten_place_symlink()` hits a non-symlink target
and, because `--force` is set, does this:

```php
// packages/reprint-importer/src/import.php
if ( is_dir( $target ) ) {
    $this->remove_directory_recursive( $target );   // ← deletes the whole local wp-content
}
symlink( $link_value, $target );
```

Everything the user had in `wp-content` — plugins, themes, uploads — goes with
it. Delta pulls are unaffected because `--force` isn't passed and `wp-content`
is already a symlink, so the call takes the `is_link()` refresh branch.

> **Not the file sync.** reprint's file-sync diff never deletes local-only
> files. Its local index (`.import-index.jsonl`) is *download-tracked* — there is
> no local filesystem scan anywhere in reprint — so a plugin the user installed
> was never in the index and was never a deletion candidate. The deletion is
> purely the forced flatten.

## The idea

Keep reprint untouched. Have Studio **carry local-only content across the
flatten**:

1. **Before** `flat-docroot` — enumerate the site's `wp-content` and work out
   which entries are *local-only* (absent from the remote's downloaded tree).
   Move them to a stash outside the site directory.
2. **Run the pull as today** — `flat-docroot --force` replaces `wp-content` with
   a symlink into the raw pull directory.
3. **After** the flatten — restore the stashed entries into the flattened
   `wp-content`. Because that path is now a symlink, the files physically land
   **inside the raw pull directory**.

### Why the restored files then survive forever

This is the load-bearing insight. reprint's delete drains only ever iterate the
**local index**, and that index only ever contains files reprint itself
downloaded. Restored files are untracked, so every later delta pull is blind to
them — they are never deletion candidates. (Verified separately: an untracked
plugin survives repeated delta pulls in both `error` and `preserve-local` modes,
with zero delete calls logged.)

## Implementation sketch

All of it lives in `apps/cli/commands/pull-reprint.ts`, around the `flat-docroot`
step in `runFullPull`.

```ts
// 1. before flat-docroot
const stash = await stashLocalOnlyContent( metadata );   // -> { path, entries[] }

// 2. existing flatten step, unchanged
await runStep( 'Flattening layout', [ 'flat-docroot', /* … --force … */ ] );

// 3. after flat-docroot
await restoreLocalOnlyContent( metadata, stash );
```

### Detecting "local-only"

An entry under the site's `wp-content` is local-only when the same relative path
does **not** exist under the remote's content directory in the raw download:

```
rawDirectory + contentDir + '/' + relativePath
```

`contentDir` comes from preflight (`getContentDirFromState`). The remote index
(`.import-remote-index.jsonl`) is an equally good oracle and is authoritative
even before files land, but note its paths are **base64-encoded**.

Walk at least these levels, since user content lives below the top:

- `wp-content/*` (custom folders, drop-ins)
- `wp-content/plugins/*`
- `wp-content/themes/*`
- `wp-content/mu-plugins/*`
- `wp-content/uploads/**` (recurse, or treat conservatively)

### Conflict policy

If a slug exists both locally and remotely, **the remote wins**: don't stash it,
and let the flatten link the remote's copy. Restoring it would shadow the pulled
content with a stale local copy.

## Trade-offs

| | |
|---|---|
| ✅ No reprint change, no phar bump, no release coupling | |
| ✅ Contained in one Studio file; easy to revert | |
| ✅ Restored content is permanently safe from delta pulls (untracked) | |
| ⚠️ User content ends up **inside reprint's raw mirror** — `raw/` is meant to be a faithful copy of the remote; this muddies ownership | |
| ⚠️ **Not atomic.** Stash → flatten → restore spans three steps. A crash or interrupt between them can strand user data in the stash | |
| ⚠️ `pull-reprint` is **resumable**, so the stash must be durable and idempotent across re-invocations | |
| ⚠️ Must be generalised beyond plugins (themes, mu-plugins, uploads, custom dirs) or it silently loses the rest | |
| ⚠️ Copy cost / temporary disk for large `uploads` unless a rename is possible | |
| ⚠️ Treats the symptom — the docroot is still a whole-directory alias | |

## Risks and edge cases

- **Interrupted pull** — the site can be left flattened with the stash not yet
  restored. Needs a stash manifest checked on resume, and restore-on-startup.
- **Symlinked local entries** — a user-created symlink should be moved as a
  link, never followed.
- **`wp-content/database`** — Studio's SQLite lives here and the pull writes its
  own copy into raw. Must be excluded from the stash so the pulled database
  wins.
- **Deferred media** — `downloadSkippedFiles` (`files-sync --filter=skipped-earlier`)
  runs *after* the flatten and writes into raw. Restored uploads share that tree,
  so restore must not collide with files still arriving.
- **Permissions / ownership** — restoring into `raw/` must preserve modes.

## When to pick B over A

Choose **B** when a reprint release is the bottleneck, when the fix must land on
a Studio release branch on its own, or when you want a small revertable change.
Choose **A** — the implemented route — when you want the docroot assembly itself
to be correct, which also fixes themes, uploads and custom folders by
construction rather than by enumeration.

### How the implemented Option A differs

Option A adds `--preserve-local-content` to reprint's `flat-docroot`. Instead of
replacing an existing real directory, it keeps it real and places the *source's*
entries inside it — recursing where both sides are real directories, symlinking
otherwise, and leaving local-only entries untouched. The remote wins on
conflicts. It also prunes symlinks it owns whose target the remote dropped, and
Studio re-runs the flatten after the deferred file tail so late-arriving media
gets linked.

Net effect: no stash, no restore, no user content inside `raw/`, and local-only
plugins, themes, uploads and custom folders survive both first and delta pulls.
