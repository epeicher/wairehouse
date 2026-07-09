# Report: emit a dispatch-free prepend artifact for host-routed PHP runtimes

> Hand-off report for the reprint repo. Prompted by a failing native-PHP
> `studio pull-reprint` in WordPress Studio.

> **✅ RESOLVED (2026-06-25) — no reprint change needed.**
> This was fixed in Studio with a one-line change: request reprint's existing
> **`nginx-fpm`** runtime target instead of `php-builtin` for native PHP.
>
> ```diff
> - const reprintRuntime = runtime === SITE_RUNTIME_NATIVE_PHP ? 'php-builtin' : 'playground-cli';
> + const reprintRuntime = runtime === SITE_RUNTIME_NATIVE_PHP ? 'nginx-fpm'  : 'playground-cli';
> ```
>
> reprint's `nginx-fpm` applier **already** emits a dispatch-free `runtime.php`
> (`generate_runtime_php()` with no routing tail), built for injection via
> `auto_prepend_file` because nginx owns routing. Studio's native
> `php -S … router.php` pool is the same "host owns routing" contract, so it
> consumes that runtime directly. Verified against **stock released reprint
> v0.8.2** — the pulled site starts and serves on native PHP, no DB error.
>
> **The reprint-side change recommended below is therefore not required.** The
> rest of this document is retained as background on the root cause. (A dedicated
> `--runtime=php-prepend` / `host-routed` target would read cleaner than reusing
> `nginx-fpm`, which also drops an unused `nginx.conf` — a nice-to-have, not
> required.)

## Context

WordPress Studio is adding native-PHP support to `studio pull-reprint`
(Automattic/studio#3881, branch `stu-1814-make-pull-reprint-work-with-native-php`).
For native PHP it runs:

```
reprint pull … --runtime=php-builtin --start-runtime=none
```

…and then boots the pulled site with **its own** PHP server: a pool of
`php -S … router.php` workers, injecting reprint's generated `runtime.php` via
`-d auto_prepend_file=runtime.php`.

This **fails**: every pulled site dies at startup with WordPress's
*"Error establishing a database connection"* (it falls back to MySQL) and the
PHP worker exits 1.

## Root cause

The **php-builtin** applier generates `runtime.php` as a **complete standalone
`php -S` router**, not a passive prepend. It concatenates two parts.

`packages/reprint-importer/src/lib/target-runtime/class-php-builtin-applier.php`,
`apply()` (~line 26-30):

```php
$runtime  = generate_runtime_php($manifest, $fs_root);    // base layers: constants, SQLite $wpdb shim, uploads proxy
$runtime .= $this->generate_cli_server_routing($options); // ← "// CLI-server routing (php -S only)." tail: require()s index.php
write_runtime_file($runtime_path, $runtime);
```

The tail (`generate_cli_server_routing()`, ~line 57) resolves the request path
and **dispatches WordPress itself** (`require …/index.php`). That is correct
when reprint owns the server (`bash start.sh` → `php -S … runtime.php`).

But when a host injects this file as `auto_prepend_file` and runs its **own**
router, the file dispatches WordPress during the prepend phase and/or in the
wrong scope, so the SQLite `$wpdb` shim no longer governs the request that
actually serves the page → WordPress instantiates the real MySQL `wpdb` →
"Error establishing a database connection" → worker exits 1.

## Evidence (verified against a live pull)

- The native PHP binary has `pdo_sqlite`/`sqlite3` — not an extension gap.
- Run as designed (`runtime.php` as the `php -S` script), the site renders
  fine on SQLite.
- **Prototype fix proven on the Studio side:** feeding PHP only the part of
  `runtime.php` *before* the `// CLI-server routing (php -S only).` marker
  (constants + SQLite shim + uploads proxy) as `auto_prepend_file`, and letting
  Studio's `router.php` dispatch, makes the site start and serve correctly:
  - `php -S … -d auto_prepend_file=<stripped> router.php` → `GET /wp-login.php`
    → `200 OK`, renders the real WP login page, **no DB error**.
  - End-to-end, the pull now reaches `site-started` and the live site serves on
    its local port.

So the split is the fix; the only question is doing it properly in reprint
instead of string-stripping downstream.

## The clean part: reprint already separates these concerns

- `generate_runtime_php()` (`functions.php:45`) returns a **complete,
  self-contained** `<?php …` file containing only the base layers (error
  handler, DB constants, the lazy SQLite `$wpdb` loader, the on-the-fly
  thumbnail + remote-uploads proxy). No routing.
- `generate_cli_server_routing()` is the **only** thing that adds dispatch, and
  it is appended *after* the base layers.
- **Precedent:** the **nginx-fpm** applier (`class-nginx-fpm-applier.php`)
  already writes `runtime.php = generate_runtime_php(...)` **with no routing
  tail**, and wires it as `auto_prepend_file={runtime_path}` via
  `fastcgi_param PHP_VALUE`. That is exactly the "host owns routing, reprint
  provides environment-only prepend" contract Studio needs.

## Recommended change

### Primary (smallest, additive, backward-compatible)

Have the php-builtin applier **also** emit a prepend-only artifact. In
`class-php-builtin-applier.php::apply()`:

```php
$base = generate_runtime_php($manifest, $fs_root);

// Full router — for `php -S runtime.php` / start.sh (unchanged behavior).
write_runtime_file($output_dir . '/runtime.php', $base . $this->generate_cli_server_routing($options));

// Prepend-only — for hosts that own request dispatch (an external php -S
// router, FPM, etc.) and inject this via auto_prepend_file. No routing tail.
write_runtime_file($output_dir . '/runtime.prepend.php', $base);
$summary[] = "Wrote {$output_dir}/runtime.prepend.php";
```

Studio then points `auto_prepend_file` at `runtime.prepend.php` instead of
`runtime.php`. `runtime.php` and `start.sh` are untouched, so standalone usage
is unaffected.

### Alternative (cleaner abstraction): a dedicated runtime target

Studio's server is not really "php-builtin" (that means *reprint* owns the
`php -S` router). Consider a target like `--runtime=php-prepend` (or
`auto-prepend` / `host-routed`) whose applier writes only
`generate_runtime_php()` to a single prepend file and no server/router/config —
purpose-built for "the host owns routing." Studio's native path would pass that
instead of `php-builtin`. (The nginx-fpm applier is the model; this is the FPM
case minus the `nginx.conf`.)

### Also worth fixing (defense-in-depth + a doc bug)

The `generate_cli_server_routing()` docblock claims the routing "only runs under
php -S (guarded by php_sapi_name check)" — **there is no such guard** in the
emitted code; the tail runs unconditionally. Either make the comment accurate or
add a real guard. A reliable guard that makes a single `runtime.php` safe in
both modes is to skip the routing tail when the file is the active auto-prepend:

```php
$__ap = ini_get('auto_prepend_file');
if (!($__ap && realpath($__ap) === realpath(__FILE__))) {
    // … CLI-server routing tail …
}
```

`php_sapi_name()` is `cli-server` in **both** cases (an external `php -S` router
with this file as auto_prepend is still `cli-server`), so a SAPI check does
*not* distinguish them — `auto_prepend_file` does. This is optional if you ship
the separate prepend file, but it hardens against future misuse.

## Suggested tests

- Unit/snapshot: php-builtin `apply()` writes both `runtime.php` (ends with the
  routing tail) and `runtime.prepend.php` (ends after the uploads-proxy block,
  **no** `// CLI-server routing` marker), both `php -l`-clean.
- Behavioral: with the prepend file as `auto_prepend_file` and a trivial
  external router that `require`s the WP entry, a request resolves
  `$GLOBALS['wpdb']` to the SQLite integration (e.g. assert
  `get_class($GLOBALS['wpdb'])` is the SQLite db class and a `SELECT` succeeds)
  — i.e. it never reaches MySQL.

## Out of scope (separate, unrelated issue)

After the start fix, the Studio pull now gets all the way up and then fails on
the *deferred* file sync (`files-pull --filter=skipped-earlier`) with:

```
Invalid response: missing multipart boundary. Body: 0%);--wp--preset--gradient--…
  reprint.phar/packages/reprint-importer/src/import.php:10175
```

This is a reprint exporter/transport problem (a response body without a
multipart boundary), independent of the runtime split. Flagging it as a separate
item worth a look — it may be transient or a real bug in the skipped-earlier
download path.

## Key files

- `packages/reprint-importer/src/lib/target-runtime/class-php-builtin-applier.php`
  — `apply()`, `generate_cli_server_routing()` (the file to change).
- `packages/reprint-importer/src/lib/target-runtime/functions.php`
  — `generate_runtime_php()` (line 45, the prepend-safe base layers),
  `write_runtime_file()` (line 357).
- `packages/reprint-importer/src/lib/target-runtime/class-nginx-fpm-applier.php`
  — precedent: base-only `runtime.php` consumed via `auto_prepend_file`.
- Studio consumer (for reference):
  `apps/cli/lib/pull/runtime-start-options.ts` →
  `loadImportedRuntimeStartOptionsNative`, and the `--runtime=php-builtin`
  selection in `apps/cli/commands/pull-reprint.ts`.
