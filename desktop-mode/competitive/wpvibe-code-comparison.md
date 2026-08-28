# Desktop Mode vs WPVibe: codebase comparison and opportunities

**Date:** July 31, 2026
**Compared:** Desktop Mode 0.9.7 (trunk @ `34cc720f`, Jul 31) vs WPVibe 1.13.3 (`~/github/wpvibe-ai-mcp`, main @ `713e22e`).
**Companion doc:** [wpvibe-growth-analysis.md](wpvibe-growth-analysis.md) (why their downloads grew).

## TL;DR

The two plugins attack the same thesis (AI should operate WordPress) from opposite directions. WPVibe brings WordPress into the AI client: its open-source plugin is a thin, hardened REST backend, and everything MCP (protocol, OAuth, tool schemas, approval UI, metering) lives in a **closed-source Cloudflare Worker at mcp.wpvibe.ai**. Desktop Mode brings AI into WordPress: a fully self-contained Copilot on the WP Core AI Client plus an opt-in durable-agents framework, with no SaaS, no API keys, and no metering.

The strategic surprise from reading both codebases: **Desktop Mode already has most of what WPVibe sells, and WPVibe lacks most of what it markets.** Desktop Mode's abilities are already annotated with `mcp => public` metadata, application-password issuance is already implemented, and the agents framework already has a stronger governance model than WPVibe's approval loop. What's missing is only the MCP transport and the packaging/positioning. Conversely, WPVibe registers zero abilities, has zero WooCommerce/ACF integration code despite marketing both, and ships zero tests for a product whose pitch is "safely give AI write access to production".

## Architecture at a glance

| | Desktop Mode 0.9.7 | WPVibe 1.13.3 |
|---|---|---|
| Vendor | Automattic | SeedProd / Awesome Motive |
| Direction | AI inside wp-admin (Cmd+K Copilot, agents) | WordPress inside AI clients (Claude/ChatGPT/Cursor) |
| MCP | No transport; abilities pre-annotated `mcp: public` | No MCP code in plugin; closed-source Worker relay is the MCP server |
| AI provider | WP Core AI Client (WP 7.0 Connectors), no keys in plugin | BYO AI client subscription; app password relayed via SaaS |
| SaaS dependency | None | Total: auth, tool schemas, approvals, skills, metering all at wpvibe.ai |
| Write access | Copilot read-only by design; writes only via opt-in agents (default off) | Full write surface (95 CLI commands, theme files, builders) behind approval flow |
| Safety model | Read-only ability boundary; agents: per-agent ability allowlist + invoker capability ceiling + agents-as-WP-users | Destructive classifier -> 409 approval -> re-invoke; blocked-options hard list; audit log table; anti-jailbreak error directives |
| Abilities API | Registers 13 abilities (8 copilot + 5 agent), consumes all site-registered ones | Registers none; consumption is Worker-side via Core REST |
| Codebase | TS + Vite, 33 bundles, vitest + PHPUnit, docs/ public contract | 15.7k LOC procedural PHP, no tests, no build tooling, one 6,323-line CLI class |
| Monetization | None | Server-side metering at wpvibe.ai (plugin is clean; cannot tell free from paid) |
| Surface | Huge UX product (~100 REST routes, windows, files, games, presence, PWA) | Almost no UI (2 admin screens); chat lives in the AI client |

## Similarities

1. **Same bet on the Abilities API** as the interop layer for AI x WordPress (Desktop Mode in code, WPVibe in marketing plus Worker-side consumption).
2. **Application passwords as the credential**. WPVibe connects through them; Desktop Mode already ships issuance/revocation UI (`includes/user-edit-window/rest.php`).
3. **Draft-first safety instinct**. WPVibe: draft themes, posts default to draft, trash-first deletes. Desktop Mode: agent `create-post` is hard-wired to draft and can never publish.
4. **Human-in-the-loop as a design value**. WPVibe: destructive classifier + approval log. Desktop Mode: read-only Copilot boundary, agent allowlists, `registerDestructiveAdminAction`, `wpd-confirm-dialog`.
5. **Prompt-injection awareness in both codebases**, with opposite mitigations: Desktop Mode never hands the model a mutating tool in attacker-influenced turns; WPVibe embeds anti-jailbreak directives in error payloads and gates the white-label toggle so an injected assistant can't hide its own audit trail.
6. **Free + GPL on wordpress.org** as the distribution base.

## Key differences

1. **Open vs closed core value.** WPVibe markets "no vendor lock-in" while its entire MCP layer, approval UI, and skills system are closed-source SaaS; if wpvibe.ai disappears, the plugin is inert. Desktop Mode is fully self-contained and Core-aligned. This is an honesty gap worth exploiting in positioning, not just noting.
2. **Distribution physics.** WPVibe inherits the AI clients' user bases (listed in the ChatGPT app store). Desktop Mode must earn wordpress.org visits. This, more than any feature, explains the install-count gap.
3. **Write capability today.** WPVibe does real site mutations now, with 95 allowlisted WP-CLI-emulated commands, theme file editing, and deep Elementor/Beaver/SeedProd/WPCode paths. Desktop Mode's mutating surface exists (agents) but is default-off, undocumented in the readme, and reachable only in-shell.
4. **Engineering rigor inverted from what you'd expect.** Desktop Mode has typecheck/lint/vitest/PHPUnit/docs-contract discipline. WPVibe has zero automated tests and a 267 KB god class, but its inline comments are exceptional: nearly every guard documents the production incident that produced it (host WAFs, stripped Authorization headers, PHP-WASM, Site Kit init order). Their changelog credibility ("we used to report success for work we didn't do") is a trust asset built from those scars.
5. **WPVibe's integrations are narrower than marketed.** Elementor (769 lines) and Beaver (457) are real; WooCommerce and ACF have literally zero integration code (generic REST/meta paths do the work). The "integrates with everything" story is mostly the Abilities/REST surface plus marketing.

## What WPVibe does well (worth stealing)

- **Structured error contract**: every `WP_Error` carries `cause` (11-value enum), `retry_ok`, `user_is_admin`, and auth diagnostics on 401s, so the AI gets facts instead of guessing. Desktop Mode's `/ai/search` tool errors could adopt this shape.
- **Hostile-host survival kit**: Authorization-header fallback via duplicated header, base64 "armoring" of code-bearing params to slip WAFs, `application_password_is_api_request` timing fix. Required reading if Desktop Mode ever exposes writes to external agents.
- **Approval flow ergonomics**: 409 + preview + re-invoke-approved, with dry-run previews that resolve targets through the exact same code path as execution.
- **Honest cache purging**: detects 8 cache engines, purges origin-first Cloudflare-last, and reports real reasons when a purge silently can't happen.
- **White-label with safety rails**: agency feature, free on all plans, with a 30-day self-revert and an approval gate on enabling it (so an injected AI can't hide the audit log).
- **Local-filtered recipes feed**: cookbook suggestions fetched with a scrubbed UA and matched against installed plugins locally, so no site data leaves. A privacy-preserving engagement loop Desktop Mode could mirror for "what can I ask the Copilot?" suggestions.

## Where Desktop Mode is already ahead

- **Abilities ecosystem citizenship**: registers 13 abilities, consumes every site-registered read-only ability automatically, and projects the full site-wide ability catalogue (including third-party ones) into the agents picker. WPVibe registers none.
- **Agent governance**: agents are real WP users with roles, capability ceilings at the invoker's level, per-agent ability allowlists, and login/app-password/reset guards. This is stronger and more auditable than a chat-side approve button, and it's verifiable open source.
- **A UX to render trust in**: WPVibe has no UI for its approval log beyond a plain admin table. Desktop Mode can render approvals, agent activity, and audit trails as first-class desktop surfaces.
- **No metering, no relay**: "your site talks to your AI directly, and the code that decides what the AI may do is all on your server" is a story WPVibe structurally cannot tell.
- **Presence, multi-user, files, Corkboard, games**: an actual product moat unrelated to the AI race.

## Opportunities (ranked)

1. **Ship the MCP transport; it is the missing 10%.** The abilities already carry `mcp => array( 'public' => true, 'type' => 'tool' )` metadata waiting for an adapter, app-password plumbing exists, and the read-only boundary maps cleanly onto an MCP tool surface. Integrating with the WordPress MCP adapter effort (rather than building a proprietary relay) would make Desktop Mode connectable from Claude/ChatGPT/Cursor and eligible for the AI-client directories that fueled WPVibe's growth, with the differentiator that the whole chain is open and self-hosted.
2. **Take the agents framework out of hiding.** It is default-off, absent from readme.txt, and unnamed in the changelog while being precisely what the market is buying. Even keeping it opt-in, it should headline the listing: seeded agents (tl;dr, SEO Medic, Alt Text Librarian, Localizer, Comment Concierge) are demo-able, screenshot-able, and directly comparable to WPVibe's "recipes".
3. **Fix the listing metadata.** Tags are `admin, dashboard, desktop, productivity, ai`; WPVibe owns `mcp, mcp-server, ChatGPT, Claude, ai-assistant`. Searchers on wordpress.org looking for AI-agent functionality cannot find Desktop Mode today. Also: WPVibe ships a release every 1-3 days and each one lifts its downloads chart; Desktop Mode merges daily but releases rarely, which reads as less momentum on the listing.
4. **Build the approval/audit surface as a native window.** Combine `registerDestructiveAdminAction`, the agents runner, and a persistent audit trail into a visible "Approvals" desktop surface. It converts Desktop Mode's UX advantage into a trust feature WPVibe can only render inside someone else's chat client.
5. **Expose Desktop Mode features as abilities.** Recycle-bin restore, notes, file placements, comment moderation could each register abilities (mutating ones gated for agents, read-only ones for MCP). Every ability makes a Desktop Mode install more valuable to ANY MCP client, including WPVibe's own users.
6. **Adopt their error contract and host-compat hardening** wherever Desktop Mode's REST surface meets AI callers (`cause` enums, auth diagnostics, WAF armoring if external writes ever ship).
7. **Consider a white-label / agency story.** WPVibe made it free on all plans because agencies drive multi-site adoption; Desktop Mode's per-user opt-in model is already agency-friendly but unmarketed.
8. **WooCommerce is an open flank.** WPVibe markets it heavily with zero dedicated code. Modest real WooCommerce abilities (read-only sales/product tools for the Copilot) would out-substance them.

## Verification notes

- WPVibe facts verified in `~/github/wpvibe-ai-mcp` source (key files: `vibe-ai.php`, `includes/class-wpvibe-cli.php` 6,323 lines with the 95-command `ALLOWLIST`, `class-wpvibe-rest.php` with 37 route registrations, `class-wpvibe-audit-log.php`, `class-wpvibe-white-label.php`, `README.md:24` for the closed Worker).
- Desktop Mode facts verified on trunk @ `34cc720f` (key files: `includes/ai-copilot/abilities.php:174-185` for the `mcp` meta profiles, `includes/agents/` 4,995 LOC, `includes/user-edit-window/rest.php:182-200` for app-password issuance, `readme.txt` for tags/positioning, `tests/phpunit/tests/aiAbilities.php` for the MCP-exposure test).
