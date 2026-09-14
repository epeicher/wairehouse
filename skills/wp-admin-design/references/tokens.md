# WordPress Design Tokens

All colors, spacing, and typography MUST use these tokens. Never hardcode values.

## Colors

```css
/* Primary — adapts to user's chosen admin color scheme */
var(--wp-admin-theme-color)               /* Primary action */
var(--wp-admin-theme-color-darker-10)     /* Hover */
var(--wp-admin-theme-color-darker-20)     /* Active */

/* Component tokens */
var(--wp-components-color-accent)              /* = theme color */
var(--wp-components-color-accent-inverted)     /* Text on accent — #fff */
var(--wp-components-color-background)          /* Surface — #fff */
var(--wp-components-color-foreground)          /* Primary text — #1e1e1e */
var(--wp-components-color-foreground-inverted) /* Text on dark */

/* Gray scale */
var(--wp-components-color-gray-100)  /* #f0f0f0 — lightest */
var(--wp-components-color-gray-200)  /* #e0e0e0 — light border */
var(--wp-components-color-gray-300)  /* #ddd — border */
var(--wp-components-color-gray-400)  /* #ccc — disabled */
var(--wp-components-color-gray-600)  /* #757575 — secondary text */
var(--wp-components-color-gray-700)  /* #616161 — strong secondary */
var(--wp-components-color-gray-800)  /* #1e1e1e — near-black */

/* Status — use Notice component with status prop instead of manual colors */
/* .notice-info: #72aee6 | .notice-success: #00a32a | .notice-warning: #dba617 | .notice-error: #d63638 */
/* For destructive actions: use Button with isDestructive prop */
```

## Typography

```css
/* Font family — NEVER change. Inherit from WordPress. */
/* -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif */

/* Font sizes */
13px  /* Default body text (base) */
14px  /* Slightly larger */
20px  /* Page titles (.wrap h1) */
23px  /* Large headings */
var(--wp-components-font-size)         /* 13px */
var(--wp-components-font-size-small)   /* 11px */

/* Font weights */
400  /* Normal — body text */
600  /* Semi-bold — section titles, labels */
700  /* Bold — page titles */

/* NEVER: import Google Fonts, use font-family, use letter-spacing, use arbitrary font sizes */
```

## Spacing

```css
4px   /* Tight — inner padding of compact elements */
8px   /* Standard — gap between related elements */
12px  /* Comfortable — padding inside cards/panels */
16px  /* Generous — section spacing */
20px  /* Page-level — .wrap padding */
24px  /* Large section gaps */

var(--wp-components-grid-unit-10)  /* 40px */
var(--wp-components-grid-unit-15)  /* 60px */
var(--wp-components-grid-unit-20)  /* 80px */
```

## Border Radius

```css
var(--wp-components-border-radius)  /* 2px — WordPress is subtle */
/* Do NOT use 8px, 12px, 16px unless matching an existing WP component */
/* 50% is allowed for circles only */
```

## Elevation

```css
var(--wp-components-elevation-z1)  /* Subtle shadow for cards */
```
