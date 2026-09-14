# Component Mapping Reference

## Admin Patterns → WordPress Implementation

| Palette Type | Implementation |
|---|---|
| Settings Page | `add_options_page()` or `add_submenu_page()` with `wp.components` form controls |
| Post List Table | Extend `WP_List_Table` class with custom columns, filters, bulk actions |
| Dashboard Widget | `wp_add_dashboard_widget()` with custom render callback |
| Admin Notice | `admin_notices` hook or `wp.data.dispatch('core/notices').createNotice()` |
| Sidebar Panel | `PluginSidebar` SlotFill via `registerPlugin()` |
| Editor Toolbar Button | `BlockFormatControls` or `PluginBlockSettingsMenuItem` SlotFill |
| Metabox | `add_meta_box()` with render callback |
| Admin Menu Item | `add_menu_page()` / `add_submenu_page()` with icon and position |
| Confirmation Dialog | `wp.components.Modal` + `wp.components.Button` |
| Onboarding Flow | `wp.components.Guide` with multiple pages |
| Bulk Action Bar | `WP_List_Table` with `bulk_actions` filter |
| Data Table | `@wordpress/dataviews` DataViews component (separate package — see DataViews section below). Script handle: `wp-dataviews`. Import from `@wordpress/dataviews/wp` in plugin context. |

## UI Components → `wp.components.*`

### Actions & Navigation

| Component | Global | Key Props |
|---|---|---|
| Button | `wp.components.Button` | `variant` ("primary"\|"secondary"\|"tertiary"\|"link"), `isDestructive`, `icon`, `disabled`, `size` ("default"\|"compact"\|"small") |
| ButtonGroup | `wp.components.ButtonGroup` | Wrapper for related Buttons |
| Dropdown | `wp.components.Dropdown` | `renderToggle`, `renderContent`, `position` |
| DropdownMenu | `wp.components.DropdownMenu` | `icon`, `label`, `controls` ([{title, icon, onClick}]) |
| ExternalLink | `wp.components.ExternalLink` | `href` |
| MenuItem | `wp.components.MenuItem` | `icon`, `isSelected`, `role`, `info` |
| MenuGroup | `wp.components.MenuGroup` | `label` |
| Navigator | `wp.components.Navigator` | `Navigator.Screen`, `Navigator.Button`, `Navigator.BackButton` |
| Toolbar | `wp.components.Toolbar` | Container for ToolbarButton / ToolbarGroup |

### Data Entry

| Component | Global | Key Props |
|---|---|---|
| TextControl | `wp.components.TextControl` | `label`, `value`, `onChange`, `help`, `type` |
| TextareaControl | `wp.components.TextareaControl` | `label`, `value`, `onChange`, `rows` |
| SelectControl | `wp.components.SelectControl` | `label`, `value`, `options` ([{label, value}]), `onChange`, `multiple` |
| CheckboxControl | `wp.components.CheckboxControl` | `label`, `checked`, `onChange` |
| RadioControl | `wp.components.RadioControl` | `label`, `selected`, `options`, `onChange` |
| ToggleControl | `wp.components.ToggleControl` | `label`, `checked`, `onChange`, `help` |
| ToggleGroupControl | `wp.components.ToggleGroupControl` | `label`, `value`, `onChange`, `isBlock` + `ToggleGroupControlOption` children |
| RangeControl | `wp.components.RangeControl` | `label`, `value`, `onChange`, `min`, `max`, `step` |
| NumberControl | `wp.components.NumberControl` | `label`, `value`, `onChange`, `min`, `max`, `step` |
| ComboboxControl | `wp.components.ComboboxControl` | `label`, `value`, `options`, `onChange` |
| FormTokenField | `wp.components.FormTokenField` | `value`, `suggestions`, `onChange`, `label` |
| InputControl | `wp.components.InputControl` | `value`, `onChange`, `prefix`, `suffix`, `size` |
| SearchControl | `wp.components.SearchControl` | `value`, `onChange`, `label` |
| DateTimePicker | `wp.components.DateTimePicker` | `currentDate`, `onChange`, `is12Hour` |
| ColorPicker | `wp.components.ColorPicker` | `color`, `onChange`, `enableAlpha` |
| ColorPalette | `wp.components.ColorPalette` | `colors`, `value`, `onChange`, `clearable` |
| FontSizePicker | `wp.components.FontSizePicker` | `fontSizes`, `value`, `onChange` |
| FormFileUpload | `wp.components.FormFileUpload` | `accept`, `onChange`, `render` |

### Layout & Containers

| Component | Global | Key Props |
|---|---|---|
| Card | `wp.components.Card` | `size` ("xSmall"\|"small"\|"medium"\|"large"), `isBorderless` + CardHeader, CardBody, CardFooter |
| Panel | `wp.components.Panel` | `header` + PanelBody, PanelRow |
| PanelBody | `wp.components.PanelBody` | `title`, `initialOpen`, `icon` (collapsible) |
| TabPanel | `wp.components.TabPanel` | `tabs` ([{name, title}]), `onSelect`, `initialTabName` |
| Modal | `wp.components.Modal` | `title`, `onRequestClose`, `isDismissible`, `size` ("small"\|"medium"\|"large"\|"fill") |
| Guide | `wp.components.Guide` | `pages` ([{image, content}]), `onFinish` |
| Flex | `wp.components.Flex` | `direction`, `gap`, `align`, `justify`, `wrap` |
| HStack | `wp.components.HStack` | `spacing`, `alignment` |
| VStack | `wp.components.VStack` | `spacing` |
| Grid | `wp.components.Grid` | `columns`, `rows`, `gap` |
| Spacer | `wp.components.Spacer` | `margin`, `padding` |
| Divider | `wp.components.Divider` | Visual separator |
| Heading | `wp.components.Heading` | `level` (1-6) |
| ItemGroup | `wp.components.ItemGroup` | `isBordered`, `isSeparated`, `size` + Item children |
| ConfirmDialog | `wp.components.ConfirmDialog` | `onConfirm`, `onCancel` |

### Feedback & Status

| Component | Global | Key Props |
|---|---|---|
| Notice | `wp.components.Notice` | `status` ("info"\|"success"\|"warning"\|"error"), `isDismissible`, `actions` |
| Snackbar | `wp.components.Snackbar` | `actions`, `onDismiss` |
| Spinner | `wp.components.Spinner` | (no props) |
| Tooltip | `wp.components.Tooltip` | `text`, `position`, `delay` |
| Popover | `wp.components.Popover` | `placement`, `offset` |
| Disabled | `wp.components.Disabled` | Wrapper that disables all children |

### Specialized

| Component | Global | Key Props |
|---|---|---|
| Icon | `wp.components.Icon` | `icon` (dashicon string, SVG, or WP icon) |
| Draggable | `wp.components.Draggable` | `elementId`, `transferData` |
| DropZone | `wp.components.DropZone` | `onFilesDrop`, `onHTMLDrop` |
| ClipboardButton | `wp.components.ClipboardButton` | `text`, `onCopy` |
| Animate | `wp.components.Animate` | `type` ("appear"\|"slide-in"\|"loading") |
| Composite | `wp.components.Composite` | Accessible composite widget |
| TreeSelect | `wp.components.TreeSelect` | `tree`, `selectedId`, `onChange` |

## DataViews & DataForm (`@wordpress/dataviews`)

**Separate package** — not part of `@wordpress/components`. Used by WordPress core for Pages, Patterns, and Templates in the Site Editor. Central to the WP Admin redesign.

**Script handle:** `wp-dataviews` (declare as dependency when enqueueing scripts).

**IMPORTANT:** In a WordPress plugin context with `wp-scripts`, import from `@wordpress/dataviews/wp` — NOT `@wordpress/dataviews`. The `/wp` subpath ensures dependencies resolve correctly against WordPress's bundled versions.

### DataViews — Dataset rendering

Renders datasets as table, grid, or list with built-in search, filters, pagination, sorting, and bulk actions.

```javascript
// Access via global (when wp-dataviews is enqueued)
const { DataViews, filterSortAndPaginate } = wp.dataviews;
```

**Key props:**

| Prop | Type | Description |
|---|---|---|
| `data` | `Array` | One-dimensional array of data objects |
| `fields` | `Array` | Field definitions (label, type, render, sort, filter config) |
| `view` | `Object` | Current view state (layout type, filters, sort, pagination) |
| `onChangeView` | `Function` | Callback when view state changes |
| `actions` | `Array` | Actions available on items (edit, delete, custom) |
| `getItemId` | `Function` | Returns unique ID for each item |
| `defaultLayouts` | `Object` | Configure available layouts (`table`, `grid`, `list`) |
| `paginationInfo` | `Object` | Total items and total pages |
| `isLoading` | `boolean` | Show loading state |

**Layouts:** `table` (default), `grid`, `list`

**Use for:** Any admin page that displays a list of items — post lists, user tables, custom data browsers, log viewers, settings lists.

### DataForm — Declarative form building

Part of the same `@wordpress/dataviews` package. Builds forms declaratively using the same field definitions as DataViews.

```javascript
const { DataForm } = wp.dataviews;
```

**Key props:**

| Prop | Type | Description |
|---|---|---|
| `data` | `Object` | Current form data |
| `fields` | `Array` | Same field definitions as DataViews |
| `form` | `Object` | Form layout configuration |
| `onChange` | `Function` | Callback when data changes |

**Use for:** Settings pages, edit forms, configuration panels. Replaces manual PanelBody + TextControl + ToggleControl composition with a single declarative component.

### DataViewsPicker — Selection interface

Compact version of DataViews for picking items. Only supports `pickerGrid` and `pickerTable` layouts.

```javascript
const { DataViewsPicker } = wp.dataviews;
```

### When to use DataViews vs. WP_List_Table

| Scenario | Use |
|---|---|
| New admin page with data browsing | DataViews (modern, React-based) |
| Extending an existing classic admin screen | WP_List_Table (PHP, matches existing pattern) |
| Settings page with form fields | DataForm |
| Quick edit / inline editing | DataForm |

## SlotFill Extension Points

| SlotFill | Location | Use Case |
|---|---|---|
| `PluginSidebar` | Editor right sidebar | Custom settings panel |
| `PluginSidebarMoreMenuItem` | Editor "more" menu | Link to open PluginSidebar |
| `PluginDocumentSettingPanel` | Document settings sidebar | Per-post settings |
| `PluginPostStatusInfo` | Post status section | Custom status indicators |
| `PluginPrePublishPanel` | Pre-publish checklist | Validation before publish |
| `PluginPostPublishPanel` | Post-publish confirmation | After-publish actions |
| `PluginMoreMenuItem` | Editor toolbar "more" menu | Custom actions |
| `PluginBlockSettingsMenuItem` | Block context menu | Per-block actions |
| `MainDashboardButton` | Editor header | Custom header button |

Import all from `wp.editor` (e.g., `const { PluginSidebar } = wp.editor;`).

## Core Blocks

Available blocks for content prototyping: `paragraph`, `heading`, `image`, `gallery`, `list`, `list-item`, `quote`, `columns`, `column`, `group`, `buttons`, `button`, `navigation`, `query`, `query-loop`, `cover`, `table`, `spacer`, `separator`, `html`, `shortcode`, `search`, `social-links`, `media-text`, `details`, `file`, `audio`, `video`, `embed`.
