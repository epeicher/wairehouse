# Fix: AI agents code and docs drift

Found while researching the AI agents webinar (2026-09-24, HEAD `f4450a97`). Four read-only explorers covered `includes/agents/`, `includes/ai-copilot/`, `src/agents-*`, `src/ai/`, `apps/my-wordpress/parts/agents*` and the related docs. Every item below still needs checking against the code before it is changed. Items marked **verified** were confirmed by grep in the research session.

## Part A: docs that are wrong (fix the doc to match the code)

| # | Where | Says | Code actually does |
|---|---|---|---|
| A1 | `docs/data-model.md:20` | The conversation CPT gets "trash, capabilities, revisions and REST for free" | `desktop_mode_chat` is registered with no REST and no revisions, and is force-deleted (`includes/agents/conversations.php:76-83`, `:520`) |
| A2 | `docs/data-model.md` (module table, about line 198) | No transients for the Agents module | Rate limiters use `desktop_mode_agent_user_rate_{invoker}_{YmdH}` and `openstation_agent_rate_{agent}_{YmdH}` (`includes/agents/runner.php:371`, `:415`). Also check that the job options (`openstation_agent_job_*`), the cron hooks (`openstation_agent_job_run`, `openstation_agent_job_cleanup`), the run log meta `_desktop_mode_agent_runs` and the faces upload dir are all listed |
| A3 | `docs/examples/ai-model-config.md:83`, `docs/hooks-reference.md:2336` | The list of `source` values for `openstation_ai_model_config` | Missing `mio/window` (`includes/ai-copilot/mio.php:136`) and `agents/draft` (`includes/agents/draft.php:109`). Full set: `ai-copilot/search`, `ai-copilot/followup`, `ai-copilot/comment-analysis`, `agents/runner`, `agents/draft`, `widgets/drafts-suggestions`, `mio/window` |
| A4 | `docs/hooks-reference.md:2274` | The Copilot "analyses entities on save" | Nothing is analysed automatically (`includes/ai-copilot/analysis.php:11-13`, `jobs.php:8-12`, `docs/migration-comments-ai-scoring.md:3`) |
| A5 | `src/agents-chat-store.ts:10`, `docs/javascript-reference.md` (about line 7885) | "Transcripts are session-only; nothing persists" | Conversations are saved on the server after every exchange (`src/agents-conversations.ts:111-144`, the `desktop_mode_chat` CPT). The shared-store snippet (about line 7876) is also missing `conversationIds` and `conversationsRev` (`src/agents-chat-store.ts:57-83`) |
| A6 | `includes/rest/README.md` | The route table | No rows for `/agents/conversations`, `/agents/conversations/{id}`, `/ai/status` or `/mio/turn`. The `/ai/platform-settings` row (about line 54) points at `includes/ai-copilot/platform-settings.php`, which does not exist, and the route is registered nowhere. The `/ai/search` row reads "logged-in + AI feature flag"; the real gate is `read` + `openstation_ai_is_available()` + the per-user `ai.enabled` toggle (`search.php:2080-2112`) |
| A7 | `includes/agents/runner.php` (docblock about line 1248) | The run log "surface[s] in the chat window's history strip" | **Verified:** `openstation_agent_runner_get_log()` (`runner.php:1301`) has no caller in `includes/` or `src/`. Make the docblock say what the log is for (an audit trail readable from PHP) |
| A8 | `includes/agents/privacy.php:8` (docblock) | The exporter covers the "invocation log" | The exporter does not export `_desktop_mode_agent_runs` (`privacy.php:42-137`). Fix the docblock here; the missing export itself is item C4 |
| A9 | `docs/examples/agents.md:67-81` | Server-side `openstation_agent_invoke()` example | It passes no `invoker`, so the run has no capability ceiling when there is no current user (cron, hooks, CLI) (`runner.php:35-39`, `:279-307`; `docs/agents-security.md:74-84`). Add `'invoker' => get_current_user_id()` where a human is behind the run, and a sentence on the system-run caveat |
| A10 | `tests/phpunit/tests/agentsDrag.php:141` (comment) | "A drop starts a fresh conversation" | In the UI, a drop into an open chat sends the existing history (`src/agents-dispatch.ts:286`, `:355-367`). Fix the comment only |
| A11 | `docs/mio-window-assistant.md:179` | "Eight provider rounds and sixteen tool executions per message" | PHP enforces only the 16 calls (`mio.php:143-154`). Find the 8-round cap in the client; if it isn't there, fix the doc |

## Part B: code bugs with an obvious fix

| # | Where | Bug | Fix |
|---|---|---|---|
| B1 | `includes/agents/default-definitions.php:239` | **Verified:** Comment Concierge allowlists `desktop-mode/search-comments-on-post`, but the registered ability is `desktop-mode/search-comments-by-post` (`includes/ai-copilot/abilities.php:257`). The runner drops unknown slugs silently (`runner.php:436-453`), so the agent never gets that tool | Fix the slug. Sites that already seeded the cast keep the wrong slug in `_desktop_mode_agent_abilities`, so add a migration in `includes/migrations.php` that rewrites `search-comments-on-post` to `search-comments-by-post` in every agent's abilities meta. Add a regression test only if it would catch this coming back (for example: every slug in the default definitions is either registered by this plugin or an `ai/*` / `core/*` external) |
| B2 | `includes/agents/face.php:275-278` | Face files are cleaned up only on `openstation_agent_deleted`, which fires only from `openstation_agent_delete()`. Deleting an agent from wp-admin → Users leaves its SVGs in `uploads/desktop-mode-agent-faces/` | Also hook the cleanup to Core's `deleted_user` when the user was an agent. The marker meta is gone by then, so check on `delete_user` and act on `deleted_user`. Low priority |

## Part C: needs a decision (verify and report, do not change)

| # | Item | Why it needs a decision |
|---|---|---|
| C1 | `desktop-mode/analyze-comment` is marked `readonly` (`includes/ai-copilot/abilities.php:412-451`), so `openstation_ai_search_ability_names()` (`:72-77`) offers it to Copilot search turns. Its docblock (`:402-405`) and `docs/migration-comments-ai-scoring.md:26` say it is not offered. `tests/phpunit/tests/aiAbilities.php:58-63` merges it in separately, as if it were not in the list | Either exclude it from search (a code change) or fix the docs. Verify first with a test |
| C2 | Tools added only through the `openstation_ai_tools` filter are shown to the model but can't be called: `$valid_tools` is widened only by ability names and client commands (`search.php:1163`, `:1295-1299`), so a call returns "Unknown tool". Synthetic commands injected through `openstation_ai_command_tools` miss the short-circuit and fall through to `openstation_ai_unknown_ability` (`search.php:1546`). The docblock at `search.php:1244` and `hooks-reference.md:2454` promise both work | Either make them dispatchable (a public API decision) or document "register a read-only ability instead" |
| C3 | `openstation_ai_ability_analyze_comment()` returns the verdict without saving `_desktop_mode_ai_analysis` or firing `openstation_ai_comment_analyzed` (`abilities.php:459-467`). `docs/migration-comments-ai-scoring.md:27,39` and `includes/migrations.php:635-636` say it does both | Decide whether the on-demand ability should save its result |
| C4 | Privacy: `_desktop_mode_agent_runs` holds the invoker's id, display name and the first 600 characters of their message and the answer (`runner.php:1265-1278`), but it is not in `openstation_agent_meta_keys()` (`store.php:137-151`) or the exporter. A human's own `desktop_mode_chat` conversations have no personal-data exporter or eraser, and go only when the human's user is deleted (`delete_with_user`) | A privacy feature, not a doc fix |
| C5 | **Security, possible leak.** `desktop-mode/get-post` checks `read_post` plus the post password, but not `is_post_type_viewable()` (`includes/agents/abilities.php:306-320`). The ability is `readonly` + `show_in_rest`, so any Subscriber may be able to read a published row of a non-viewable CPT (an order, a submission log). That is exactly the class described in `AGENTS.md` ("A status is not a permission") and `docs/agents-security.md:223-230` | Verify with a Subscriber-versus-non-viewable-CPT test. If confirmed, fix it in its own security PR, not in this docs PR |
| C6 | `desktop-mode/get-media` gates only on `upload_files` (`abilities.php:368-375`), not on the readability of the attachment or its parent post, and it returns the caption and parent id | Same review as C5 |
| C7 | Triggers are UI routing, not authorization: a direct `POST /invoke` with `source: 'drag'` works for an agent with no drag trigger, unless a trigger row sets `capability` (`store.php:901-955`) | Decide whether that is the intended contract; if so, write it down in `docs/agents-security.md` |

## Out of scope

- `docs/plans/2026-07-27-001-feat-ai-agents-user-meta-plan.md` and `docs/plans/2026-08-25-001-feat-agent-run-time-budget-plan.md` describe designs the code didn't follow: the time budget was never built, the async jobs of #787 replaced it, and the plan names filters that don't exist. They are historical plans, so leave them alone.
- The #635 commit message says the wizard has four steps; the code has five. That is git history, so it can't be fixed.

## Suggested delivery

- **PR 1 (docs + B1 + B2):** Part A plus Part B, on a `fix/ai-agents-docs-drift` branch.
- **PR 2 (security):** C5 and C6, if they are confirmed.
- **Decisions for Roberto / Daniel:** C1, C2, C3, C4 and C7.

## Status (2026-09-24)

The Part A and Part B work is done, uncommitted, on branch `fix/ai-agents-docs-drift` in the worktree `.claude/worktrees/agent-aceba25869623e425`: 15 files, +254 / -24. Build, lint, typecheck, test:js and lint:php all pass. PHPUnit passes on the full suite, single-site and multisite.

- **A1–A10:** fixed.
- **A11:** skipped, because the doc was already right: the 8-round cap is `MIO_LIMITS` in `src/mio/assistant/operations.ts:4`.
- **B1:** fixed, with migration 9 plus a guard test and a migration test.
- **B2:** fixed, with a Core-delete test. On multisite the face files stay while the user row exists on other sites.

Part C results (all confirmed, no code changed):
- **C5 is a real leak.** A Subscriber reads the raw body of a published row of a non-viewable CPT, both through `execute()` and through `GET /wp-abilities/v1/abilities/desktop-mode/get-post/run` (HTTP 200). Fix it in a separate security PR.
- **C6 is a real leak.** An Author gets the title, caption and `attachedTo` of media attached to a private post they cannot read. It goes in the same PR as C5.
- **C7 is worse than first described.** A `capability` set only on the chat trigger is bypassed by posting `source: 'drag'`.
- **C1 confirmed by test.** Recommendation: exclude `analyze-comment` from search.
- **C2 confirmed.** Recommendation: document "register a read-only ability".
- **C3 confirmed.** Recommendation: have the ability save its result, as the docs promise.
- **C4 confirmed.** `openstation_agent_meta_keys()` has no callers at all. Recommendation: add a personal-data exporter and eraser for humans.
