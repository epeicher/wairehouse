# AllTerrain Photo Editor: open configured after a live activation

**Repo:** allterrain-photo-editor (tested against 1.1.1)
**Depends on:** OpenStation PR #825 (lazy scripts replay their declared dependencies)

## The bug

Boot the shell with Photo Editor inactive, activate it from the Plugins window, open it. The window appears and stays blank. After an F5 it works.

Deactivating and reactivating in the same session does *not* reproduce it, because the editor bundle was printed at boot and is still in the page. A fresh install is the case that fails, and it is the one users hit.

## Why

The app is declared in `apps/photo-editor/photo-editor.os.php` with only a client view:

```php
return App::define( 'lienzo' )
	// …
	->client( LIENZO_DIR . 'assets/js/lienzo-app' . $lienzo_app_suffix . '.js' );
```

That client bundle does not contain the editor. `mountEditor()` in it polls for `window.lienzo.renderDesktopWindow` for five seconds (`MAIN_BUNDLE_WAIT_MS`) and gives up. The function comes from the main bundle, script handle `lienzo`, which is only ever put on the page by `lienzo_enqueue_in_shell()` on `openstation_mode_init`, a hook that fires while the shell page renders at boot. The window registration never names the handle, so on a live activation the shell has no record that the bundle exists and nothing loads it.

Two more things are attached at the wrong moment, inside `lienzo_enqueue_editor()` in `includes/assets.php`:

- the config, `wp_add_inline_script( 'lienzo', 'window.lienzoConfig = …', 'before' )`
- the stylesheet, `wp_enqueue_style( 'lienzo' )`

OpenStation harvests a handle's inline data off the *registered* handle when it builds the window payload. Data attached only when the handle is enqueued on the shell page is invisible to a payload built from the Plugins window's request, where that enqueue never ran.

## The fix

Three changes, all in the plugin. No shell change is needed beyond OpenStation #825, which makes a window's companion scripts carry their declared dependencies and inline data on a live activation.

### 1. Declare the main bundle and its stylesheet on the app window

OpenStation exposes `openstation_app_window_args` for exactly this: appending registered `scripts` / `styles` handles to an app window just before `openstation_register_window()` runs. Add to `includes/desktop-mode.php`, next to `lienzo_register_apps_directory()`:

```php
add_filter( 'openstation_app_window_args', 'lienzo_app_window_args', 10, 2 );

/**
 * Rides the editor bundle and its stylesheet on the app window.
 *
 * The client view only mounts the editor; the editor itself is the
 * `lienzo` handle. Naming it here is what lets the shell load it with
 * the window on first open, including on a live activation, instead of
 * relying on the boot-time enqueue that a plugin activated mid-session
 * never got.
 *
 * @param array  $args `openstation_register_window()` args.
 * @param string $id   App id.
 * @return array
 */
function lienzo_app_window_args( $args, $id ) {
	if ( 'lienzo' !== $id ) {
		return $args;
	}
	// Ahead of the client bundle, so `window.lienzo` exists before the
	// client view's first mount attempt rather than its first poll.
	$args['scripts'] = array_merge( array( 'lienzo' ), (array) ( $args['scripts'] ?? array() ) );
	$args['styles']  = array_merge( (array) ( $args['styles'] ?? array() ), array( 'lienzo' ) );
	return $args;
}
```

Companions load in declared order before the window's own script, so `lienzo` is in the tab before `lienzo-app` runs. The poll in `mountEditor()` can stay as a safety net.

### 2. Attach the config at registration, not at enqueue

Move the `wp_add_inline_script()` call out of `lienzo_enqueue_editor()` into `lienzo_register_assets()` (already on `init`), right after `wp_register_script( 'lienzo', … )`:

```php
wp_add_inline_script(
	'lienzo',
	'window.lienzoConfig = ' . wp_json_encode( lienzo_get_config() ) . ';',
	'before'
);
```

The "safe to call more than once" guard in `lienzo_enqueue_editor()` becomes unnecessary; the inline is on the handle exactly once for the life of the request, and every enqueue path (shell boot, the standalone admin page, the media actions) prints it as before. This is the pattern AllTerrain Forms already uses with its `allterrain-forms-config` handle.

`lienzo_get_config()` calls `wp_create_nonce()` and `current_user_can()`. Both are fine on `init`: the current user is set before it fires.

### 3. Keep the boot-time enqueue

`lienzo_enqueue_in_shell()` on `openstation_mode_init` stays. It gives a normal boot the editor bundle up front, and with the config on the registered handle it prints the same inline it does today. Nothing about the boot path changes; the live-activation path simply stops depending on it.

## Verify

1. On a site with OpenStation at or after #825 and Photo Editor inactive, load the shell.
2. Activate Photo Editor from the Plugins window. Do not reload.
3. Open Photo Editor from its desktop icon or dock tile.

Expected: the editor renders, `window.lienzo` and `window.lienzoConfig` are defined, and the `lienzo` stylesheet is in `<head>`. Then reload and open again to confirm the boot path still works and the bundle is not injected twice (one `<script>` tag for `lienzo.js`).

## Out of scope

The shell-side gap that made Forms fail (dependencies of a lazily loaded bundle were never replayed) is fixed in OpenStation #825 and is not a Photo Editor concern. Photo Editor fails for a different reason: it never tells the shell about its main bundle.
