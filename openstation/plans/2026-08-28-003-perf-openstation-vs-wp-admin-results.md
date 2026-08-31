---
title: "perf: OpenStation vs classic wp-admin on openstation.blog — measured results"
type: perf
status: collected
date: 2026-08-28
---

# perf: OpenStation vs classic wp-admin on openstation.blog

Measured live on `https://openstation.blog/wp-admin`, WordPress 7.1, Gutenberg plugin active, OpenStation 1.1.4 including the dedicated shell screen (`admin.php?page=openstation`). Protocol: [2026-08-28-002](2026-08-28-002-perf-openstation-vs-wp-admin-measurement-plan.md).

Both arms ran in the same browser, same account, same session, alternating in blocks. Baseline arm is real classic wp-admin via the per-request `?desktop_mode_classic=1` flag (verified on every sample: no `os-shell`, admin menu and admin bar present). Nothing was written to the site beyond the desktop session.

## Headline

**After the first screen, OpenStation is faster than wp-admin on every screen measured, and returning to a screen you already opened is effectively instant.** The desktop costs about 1.7 s once, at boot, and pays that back by roughly the third screen you open.

## 1. Opening a screen (shell already running)

Median of 9 samples per screen per arm. `after TTFB` is `load − TTFB`: the part the plugin controls, with the host's response time removed.

| Screen | OpenStation `load` | classic `load` | Δ | OpenStation after TTFB | classic after TTFB | Δ |
|---|---|---|---|---|---|---|
| Posts | **2110 ms** | 2650 ms | **−20%** | **1172 ms** | 1559 ms | **−25%** |
| Media | **1818 ms** | 2414 ms | **−25%** | **823 ms** | 1528 ms | **−46%** |
| Plugins | **1851 ms** | 2733 ms | **−32%** | **782 ms** | 1711 ms | **−54%** |
| Post editor | **2621 ms** | 3655 ms | **−28%** | **895 ms** | 1960 ms | **−54%** |

The post editor (draft 402, "Why do I need OpenStation?", n=5 per arm) is the heaviest screen in wp-admin and shows the largest absolute saving: 895 ms against 1960 ms of browser time.

TTFB was statistically indistinguishable between arms (Posts 1016 vs 1117, Media 936 vs 929, Plugins 1119 vs 1028, editor 1532 vs 1605), which is the point: the server does the same work, and the difference is what the browser does afterwards.

Ranges (min–max), showing the separation is not an artefact of picking medians:

| Screen | OpenStation after TTFB | classic after TTFB | Overlap |
|---|---|---|---|
| Posts | 740 – 1381 | 1220 – 2012 | partial |
| Media | 606 – 1235 | 1363 – 1916 | **none** |
| Plugins | 502 – 1052 | 1384 – 1867 | **none** |
| Post editor | 701 – 1243 | 1510 – 2293 | **none** |

For Media, Plugins and the editor the two distributions do not overlap at all: the slowest OpenStation sample still beat the fastest classic sample. Posts is the only screen where they graze, between 1220 and 1381 ms.

## 2. Returning to a screen already open

18 samples, all confirmed real frames in a visible tab.

| | OpenStation | classic |
|---|---|---|
| Return to an open screen | **≤ 30 ms** (29–31) | a full navigation, 2.4–2.7 s |

30 ms is the floor of a double-`requestAnimationFrame` probe, so the honest statement is "within two frames", not "30 ms". Classic wp-admin has no equivalent: every revisit is another full page load.

## 3. Booting the desktop (the arm classic wins)

5 samples each, warm browser cache.

| | median `load` | range |
|---|---|---|
| classic Dashboard | **5528 ms** | 5006 – 6310 |
| OpenStation shell + Dashboard in a window | **7190 ms** | 6449 – 8213 |

The shell document's `load` includes its first window's iframe, which loaded in 4598 ms on its own. So booting the desktop costs roughly **+1.7 s, once per session**.

**Payback:** at an average saving of ~763 ms of `load` per screen opened (across all four screens), the boot cost is recovered **by the third screen**, and every return to an already-open screen saves a further ~2.5 s.

## Method notes that matter for reproducing this

- **Both arms use `PerformanceNavigationTiming` on the document being displayed.** For OpenStation that is the window's iframe document, read same-origin. Identical metric on both sides, so there is no DCL-versus-load mismatch to argue about.
- **A hidden tab invalidates everything.** Chrome freezes `requestAnimationFrame` and throttles timers in background tabs. An early batch here recorded 2601 ms and 2993 ms "focus" times that were purely the fallback timer firing, and screen loads of 3200–4000 ms that dropped to 1500–1950 ms once the tab was actually visible. Every sample above carries `visibilityState: visible`.
- **Two classic samples were discarded** where `loadEventEnd` was still 0, meaning the timing was read before the load event fired. Posts therefore has n=7 on the classic side, the rest n=9.
- Server variance is large on this host: TTFB ranged 788–1825 ms across the session. This is why TTFB is reported separately and why `load − TTFB` is the more meaningful comparison.

## Why OpenStation wins the day-to-day case

Not measurement trickery, architecture. A window loads a chromeless admin document that does not build the admin bar (#684) or the admin menu, and whose window stylesheets were already fetched on first open (#661). Classic wp-admin re-downloads, re-parses and re-executes the entire admin chrome on every navigation. And a revisit is a focus rather than a navigation.

## Shareable write-up

Published as an artifact: https://claude.ai/code/artifact/77dc792c-66b0-4082-b420-e4d97d781a03

## Not measured

- A genuinely cold cache (no service worker, cleared storage). All figures above are warm-cache.
- Version-over-version (1.1.3 vs 1.1.4). This compares OpenStation against classic wp-admin, not against a previous release.
