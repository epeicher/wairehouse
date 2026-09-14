# Modification Strategies & Code Examples

Choose the simplest approach: CSS-only → PHP hooks → JS with wp.components → full React.

**CRITICAL: Never use inline `<script>` tags or `wp_add_inline_script` for code that depends on `wp.*` globals.** On classic admin pages, these globals aren't loaded by default and inline scripts execute before WordPress resolves the dependency graph. Always write JS to a **separate file** and enqueue it with `wp_enqueue_script` + proper dependencies.

Every JS-based strategy requires TWO files written via Playground MCP:
1. A `.php` file that registers the admin page and enqueues the script
2. A `.js` file containing the actual component code

## Strategy 1: CSS-Only (visual tweaks, spacing, colors)

CSS-only changes are safe as inline styles — no `wp.*` dependency issue.

```php
<?php
// wp-content/mu-plugins/design-prototype-visual-tweaks.php
add_action('admin_head', function() {
    echo '<style>
        .edit-post-sidebar .components-panel__body-title {
            font-size: var(--wp-admin-font-size-lg, 14px);
            color: var(--wp-admin-theme-color, #3858e9);
        }
    </style>';
});
```

## Strategy 2: Admin Pages & Menus (PHP-only)

Menu changes are pure PHP — no JS needed.

```php
<?php
// wp-content/mu-plugins/design-prototype-admin-pages.php
add_action('admin_menu', function() {
    add_menu_page('Analytics', 'Analytics', 'manage_options',
        'design-analytics', 'render_analytics_page', 'dashicons-chart-area', 3);
});

function render_analytics_page() {
    echo '<div class="wrap"><h1>Analytics</h1>';
    echo '<div id="design-analytics-root"></div></div>';
}

// Remove menu items
add_action('admin_menu', function() { remove_menu_page('edit-comments.php'); }, 999);

// Reorder menu
add_filter('custom_menu_order', '__return_true');
add_filter('menu_order', function($menu_order) {
    return array('index.php', 'design-analytics', 'separator1', 'edit.php', 'upload.php');
});
```

## Strategy 3: React Admin Page (wp.components on classic admin pages)

**Two files required.** The PHP enqueues the JS with dependencies. The JS uses `wp.*` globals that WordPress guarantees are loaded before your script runs.

**PHP file:**
```php
<?php
// wp-content/mu-plugins/design-prototype-analytics.php
add_action('admin_menu', function() {
    add_menu_page('Analytics', 'Analytics', 'manage_options',
        'design-analytics', 'render_analytics_page', 'dashicons-chart-area', 3);
});

function render_analytics_page() {
    echo '<div class="wrap"><h1>Analytics</h1>';
    echo '<div id="design-analytics-root"></div></div>';
}

add_action('admin_enqueue_scripts', function($hook) {
    if ($hook !== 'toplevel_page_design-analytics') return;

    wp_enqueue_style('wp-components');
    wp_enqueue_script(
        'design-prototype-analytics',
        plugins_url('design-prototype-analytics.js', __FILE__),
        array('wp-element', 'wp-components'),
        '1.0.0',
        true
    );
});
```

**JS file:**
```javascript
// wp-content/mu-plugins/design-prototype-analytics.js
(function() {
    var el = wp.element.createElement;
    var useState = wp.element.useState;
    var Card = wp.components.Card;
    var CardHeader = wp.components.CardHeader;
    var CardBody = wp.components.CardBody;
    var TabPanel = wp.components.TabPanel;
    var Heading = wp.components.Heading;

    var AnalyticsPage = function() {
        return el(Card, null,
            el(CardHeader, null, el(Heading, { level: 3 }, 'Site Analytics')),
            el(CardBody, null,
                el(TabPanel, {
                    tabs: [
                        { name: 'traffic', title: 'Traffic' },
                        { name: 'content', title: 'Content' },
                        { name: 'engagement', title: 'Engagement' }
                    ]
                }, function(tab) {
                    return el('p', null, 'Content for: ' + tab.title);
                })
            )
        );
    };

    var rootEl = document.getElementById('design-analytics-root');
    if (rootEl) {
        wp.element.createRoot(rootEl).render(el(AnalyticsPage));
    }
})();
```

## Strategy 4: Editor Sidebar / SlotFill

Editor-only features use `enqueue_block_editor_assets`. The block editor context loads `wp.*` globals reliably, but the separate-file pattern is still recommended for consistency.

**PHP file:**
```php
<?php
// wp-content/mu-plugins/design-prototype-editor-sidebar.php
add_action('enqueue_block_editor_assets', function() {
    wp_enqueue_script(
        'design-prototype-sidebar',
        plugins_url('design-prototype-editor-sidebar.js', __FILE__),
        array('wp-plugins', 'wp-editor', 'wp-components', 'wp-element'),
        '1.0.0',
        true
    );
});
```

**JS file:**
```javascript
// wp-content/mu-plugins/design-prototype-editor-sidebar.js
(function() {
    var el = wp.element.createElement;
    var useState = wp.element.useState;
    var registerPlugin = wp.plugins.registerPlugin;
    var PluginSidebar = wp.editor.PluginSidebar;
    var PluginSidebarMoreMenuItem = wp.editor.PluginSidebarMoreMenuItem;
    var PanelBody = wp.components.PanelBody;
    var ToggleControl = wp.components.ToggleControl;

    var DesignPrototypeSidebar = function() {
        var state = useState(false);
        var isEnabled = state[0];
        var setEnabled = state[1];

        return el(wp.element.Fragment, null,
            el(PluginSidebarMoreMenuItem, { target: 'design-prototype-panel' }, 'Design Prototype'),
            el(PluginSidebar, { name: 'design-prototype-panel', title: 'Design Prototype', icon: 'admin-appearance' },
                el(PanelBody, { title: 'Settings', initialOpen: true },
                    el(ToggleControl, { label: 'Enable feature', checked: isEnabled, onChange: setEnabled })
                )
            )
        );
    };

    registerPlugin('design-prototype', { render: DesignPrototypeSidebar });
})();
```

## Strategy 5: Flow Modifications (confirmation steps, interstitials)

**PHP file:**
```php
<?php
// wp-content/mu-plugins/design-prototype-publish-confirmation.php
add_action('enqueue_block_editor_assets', function() {
    wp_enqueue_script(
        'design-prototype-publish-confirmation',
        plugins_url('design-prototype-publish-confirmation.js', __FILE__),
        array('wp-plugins', 'wp-editor', 'wp-components', 'wp-element'),
        '1.0.0',
        true
    );
});
```

**JS file:**
```javascript
// wp-content/mu-plugins/design-prototype-publish-confirmation.js
(function() {
    var el = wp.element.createElement;
    var useState = wp.element.useState;
    var registerPlugin = wp.plugins.registerPlugin;
    var PluginPrePublishPanel = wp.editor.PluginPrePublishPanel;
    var CheckboxControl = wp.components.CheckboxControl;
    var Notice = wp.components.Notice;

    var PublishConfirmation = function() {
        var state = useState(false);
        var confirmed = state[0];
        var setConfirmed = state[1];

        return el(PluginPrePublishPanel, { title: 'Publishing Checklist', initialOpen: true },
            el(Notice, { status: 'warning', isDismissible: false }, 'Please review before publishing:'),
            el(CheckboxControl, { label: 'Content reviewed for accuracy', checked: confirmed, onChange: setConfirmed }),
            el(CheckboxControl, { label: 'Featured image is set', checked: false, onChange: function() {} }),
            el(CheckboxControl, { label: 'SEO metadata is complete', checked: false, onChange: function() {} })
        );
    };

    registerPlugin('publish-confirmation', { render: PublishConfirmation });
})();
```

## Strategy 6: Dashboard Widgets (PHP-only)

```php
<?php
// wp-content/mu-plugins/design-prototype-dashboard-widget.php
add_action('wp_dashboard_setup', function() {
    wp_add_dashboard_widget('design_prototype_widget', 'Recent Activity', function() {
        echo '<div class="activity-widget"><p>Widget content rendered via PHP.</p></div>';
    });
});
```

## Strategy 7: Modifying Existing Screens (PHP + vanilla JS)

For simple DOM changes (headings, labels) that don't use `wp.*` globals, inline vanilla JS is fine.

```php
<?php
// wp-content/mu-plugins/design-prototype-screen-mods.php

// Change admin footer
add_filter('admin_footer_text', function() { return 'Custom Admin Prototype'; });

// Modify post list columns
add_filter('manage_posts_columns', function($columns) {
    unset($columns['author'], $columns['comments']);
    $columns['status_badge'] = 'Status';
    return $columns;
});

// Modify admin bar
add_action('admin_bar_menu', function($wp_admin_bar) {
    $wp_admin_bar->remove_node('comments');
    $wp_admin_bar->add_node(array('id' => 'prototype-link', 'title' => 'View Prototype', 'href' => '#'));
}, 999);

// Change page headings — vanilla JS only (no wp.* dependency), so inline is safe
add_action('admin_footer', function() {
    echo '<script>
        document.addEventListener("DOMContentLoaded", function() {
            var h = document.querySelector(".wrap h1");
            if (h && h.textContent === "Posts") h.textContent = "Content Library";
        });
    </script>';
});
```

## Strategy 8: DataViews (modern data tables, grids, lists)

**PHP file:**
```php
<?php
// wp-content/mu-plugins/design-prototype-dataviews-page.php
add_action('admin_menu', function() {
    add_menu_page('Content Browser', 'Content Browser', 'manage_options',
        'design-content-browser', 'render_content_browser', 'dashicons-list-view', 4);
});

function render_content_browser() {
    echo '<div class="wrap"><h1>Content Browser</h1>';
    echo '<div id="design-content-browser-root"></div></div>';
}

add_action('admin_enqueue_scripts', function($hook) {
    if ($hook !== 'toplevel_page_design-content-browser') return;

    wp_enqueue_style('wp-components');
    wp_enqueue_script(
        'design-prototype-content-browser',
        plugins_url('design-prototype-dataviews-page.js', __FILE__),
        array('wp-element', 'wp-components', 'wp-dataviews'),
        '1.0.0',
        true
    );
});
```

**JS file:**
```javascript
// wp-content/mu-plugins/design-prototype-dataviews-page.js
(function() {
    var el = wp.element.createElement;
    var useState = wp.element.useState;
    var useMemo = wp.element.useMemo;
    var DataViews = wp.dataviews.DataViews;
    var filterSortAndPaginate = wp.dataviews.filterSortAndPaginate;

    var sampleData = [
        { id: 1, title: 'Getting Started Guide', type: 'page', status: 'published' },
        { id: 2, title: 'Release Notes v2.0', type: 'post', status: 'draft' },
        { id: 3, title: 'API Reference', type: 'page', status: 'published' },
    ];

    var fields = [
        { id: 'title', label: 'Title', enableGlobalSearch: true },
        { id: 'type', label: 'Type', elements: [
            { value: 'post', label: 'Post' }, { value: 'page', label: 'Page' }
        ]},
        { id: 'status', label: 'Status', elements: [
            { value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }
        ]},
    ];

    var ContentBrowser = function() {
        var state = useState({
            type: 'table', perPage: 10, page: 1,
            sort: { field: 'title', direction: 'asc' },
            search: '', filters: [], fields: ['title', 'type', 'status'],
        });
        var view = state[0];
        var setView = state[1];

        var result = useMemo(function() {
            return filterSortAndPaginate(sampleData, view, fields);
        }, [view]);

        return el(DataViews, {
            data: result.data,
            fields: fields,
            view: view,
            onChangeView: setView,
            paginationInfo: result.paginationInfo,
            getItemId: function(item) { return item.id.toString(); },
            defaultLayouts: { table: {}, grid: {} },
        });
    };

    var rootEl = document.getElementById('design-content-browser-root');
    if (rootEl) wp.element.createRoot(rootEl).render(el(ContentBrowser));
})();
```

## Key Rules for All Strategies

- **NEVER** use `wp_add_inline_script` or inline `<script>` for code that references `wp.*` globals
- **ALWAYS** write JS to a separate `.js` file and enqueue with `wp_enqueue_script` + dependency array
- **ALWAYS** include `wp_enqueue_style('wp-components')` when rendering wp.components on classic admin pages
- For DataViews pages, add `'wp-dataviews'` to the dependency array
- Use `createElement` (aliased as `el`), not JSX (no build step in Playground)
- One feature per mu-plugin (PHP file + JS file pair)
- Prefix all files with `design-prototype-`
- CSS-only changes via `admin_head` are fine — the inline restriction only affects JS
- Vanilla JS that doesn't use `wp.*` globals can be inline (e.g., simple DOM text changes)
