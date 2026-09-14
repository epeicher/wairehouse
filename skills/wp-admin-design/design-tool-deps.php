<?php
/**
 * Plugin Name: WP Admin Design Tool — Dependency Loader
 * Description: Ensures @wordpress/components, @wordpress/element, and @wordpress/dataviews
 *              are loaded on all admin pages, not just the block editor. This mu-plugin is
 *              written into Playground by the Blueprint and is required for the design tool
 *              to work on classic admin pages.
 *
 * @prototype
 */

add_action( 'admin_enqueue_scripts', function() {
    // These scripts are registered by WordPress/Gutenberg core but only
    // enqueued automatically on block editor pages. We force-enqueue them
    // on ALL admin pages so design prototypes can use wp.components anywhere.

    // Check that the handles exist (Gutenberg must be active)
    $required = array( 'wp-element', 'wp-components', 'wp-data', 'wp-i18n' );
    $missing  = array();

    foreach ( $required as $handle ) {
        if ( wp_script_is( $handle, 'registered' ) ) {
            wp_enqueue_script( $handle );
        } else {
            $missing[] = $handle;
        }
    }

    // Also enqueue the component styles
    if ( wp_style_is( 'wp-components', 'registered' ) ) {
        wp_enqueue_style( 'wp-components' );
    }

    // Optionally enqueue DataViews if registered
    if ( wp_script_is( 'wp-dataviews', 'registered' ) ) {
        wp_enqueue_script( 'wp-dataviews' );
    }

    // Enqueue editor packages for SlotFill support
    $editor_packages = array( 'wp-plugins', 'wp-editor', 'wp-blocks', 'wp-block-editor' );
    foreach ( $editor_packages as $handle ) {
        if ( wp_script_is( $handle, 'registered' ) ) {
            wp_enqueue_script( $handle );
        }
    }

    // Surface errors visibly if critical packages are missing
    if ( ! empty( $missing ) ) {
        add_action( 'admin_notices', function() use ( $missing ) {
            echo '<div class="notice notice-error"><p>';
            echo '<strong>WP Admin Design Tool:</strong> Missing script handles: <code>' . implode( '</code>, <code>', $missing ) . '</code>. ';
            echo 'Ensure the Gutenberg plugin is installed and active.';
            echo '</p></div>';
        });
    }
}, 5 ); // Priority 5 — run early so prototypes can depend on these
