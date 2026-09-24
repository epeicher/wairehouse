# Explorer findings (HEAD f4450a97), key facts for the learning plan

## Data model / identity (explorer 1)
- Agent = real wp_users row + marker meta `_desktop_mode_agent`; definition in user meta (description, instructions, abilities JSON, triggers JSON, model [unused], rate_limit, created_by, vibes, face, face_seed, runs log capped 50).
- Why: Core caps, edit locks, attribution, audit trail without a parallel ACL (identity.php:5-9).
- Guard always loads (even feature off): authenticate p30, determine_current_user PHP_INT_MAX, no pw reset, no app passwords, no change emails, author archive 404.
- Feature flag = extended-options `agents` key, off by default; enabling needs manage_options.
- Caps: read=edit_posts, manage=edit_users, invoke=edit_posts (filterable). Role assign needs promote_users; admin role needs real admin/super admin. Subscriber rejected.
- 5 seeded agents: tl;dr (editor), Comment Concierge (editor, read-only), Localizer (author, create-post drafts), SEO Medic (editor), Alt Text Librarian (editor, media). Seeded once on admin_init, never into a site with any agent.
- ai/* abilities come from the AI experiments plugin; missing slugs silently dropped.
- Faces: partial Mio look, SVG rendered on save into uploads/desktop-mode-agent-faces; pre_get_avatar_data swap; per-site only on multisite.
- Conversations: CPT desktop_mode_chat, owner-only (not even admins), 100/user, 200 msgs, tool outputs dropped; delete_with_user.
- Privacy exporter/eraser only for agent emails; human chats not exported (gap); run log not exported.
- BUGS: Comment Concierge lists `search-comments-on-post` (real: `search-comments-by-post`) VERIFIED; run log never read VERIFIED; wp-admin delete leaves face files; data-model.md drift (CPT REST/revisions, transients).

## Runner / abilities / guard / jobs (explorer 2)
- Entry: POST /agents/{id}/invoke (sync or async w/ requestId); UI always async jobs.
- Loop: MAX_TURNS 8 + one forced tool-less turn; unlimited calls per turn; one retry on transient errors (refusal "Missing content key", No models found, cURL 28, 50x); 180s HTTP timeout per provider call; no streaming.
- Runs AS the agent user (wp_set_current_user), with user_has_cap ceiling = agent role ∩ invoker caps. No ceiling for system runs (no invoker). Filter openstation_agent_restrict_to_invoker.
- Tool calls -> wp_get_ability()->execute() (permission_callback + schema). Tool names: namespace stripped, dashes->underscores.
- History replayed as text transcript, not function-call turns (provider signature issues). Tool output fenced in <untrusted-tool-output>, trust rule appended: "mitigation, not a guarantee".
- Model call: openstation_ai_client_generate -> wp_ai_client_prompt (WP 7.0 AI Client / Connectors). Answer schema {text, call_to_actions[]} (max 4 CTAs).
- Own abilities: get-post (ro), get-media (ro), update-media, create-post (forced draft), update-post (publish needs publish_posts). Any registered ability can be allowlisted.
- No server-side approval step; CTAs are prompt convention + UI.
- Rate limits: 60/h per agent, 120/h per invoker, counted before run.
- Jobs: option-backed, idempotent UUID, one outstanding per (human, agent) -> 409, cron single event + spawn_cron + fastcgi_finish_request, atomic claim never replays, 2h lifetime, cleanup 1 day, owner-only polling, client backoff 2s..10s.
- Triggers wired: chat, send-to, drag. hook/endpoint/agent declared wired:false. Entity handed as a sentence with id; model fetches via tools. Title unfenced in that sentence.
- Server doesn't enforce trigger kind (direct POST source:drag works without drag trigger).
- PR #460 six security fixes; PR #467 provider robustness; #530 empty answer; #787 async jobs (time-budget plan never built); #803 password-protected seal.
- Plan docs stale: model override unused, no hook triggers, filter names differ.

## AI Copilot layer (explorer 3)
- Uses Core WP 7.0 AI Client (wp_ai_client_prompt) + Connectors; OpenStation stores NO keys, pins NO provider/model. Keys in Settings > Connectors. Migration 3 deleted legacy keys. Plugin header says WP 6.0; AI inert below 7.0.
- Probes: provider_configured (text) vs assistant_provider_configured (text + function calling). GET /ai/status.
- openstation_ai_model_config($config, $context{user_id, request_id, source, has_tools, has_schema}); sources: ai-copilot/search, ai-copilot/followup, ai-copilot/comment-analysis, agents/runner, agents/draft, widgets/drafts-suggestions, mio/window.
- Response schema normalizer: additionalProperties false + all keys required at every depth (OpenAI strict). Tool schema normalizer: strip top-level oneOf etc, strip WP-only keys. Thought parts stripped (Anthropic signature).
- /ai/search: gate read + AI available + per-user ai.enabled (opt-in, default false). Max 10 tool rounds, <=11 provider calls; continue{} resume after 100 items. Native keyword search, no embeddings. Answer {answer_type entity|navigation|chat, message, entity_id, entity_type, admin_links}; entity re-authorized on hydration.
- Tools = every readonly ability (any plugin) automatically. mcp.public on search abilities.
- command_tools: aiCallable commands via wp.os.ai.ask; command_<slug>; tool_call short-circuit; client runs run(); follow_up summarises.
- Hooks: openstation_ai_{request, system_prompt_appendix, system_prompt_replace_capability (manage_options), system_prompt, command_allowed, command_tools, tools, tool_result, answer, followup_outcome_max_chars, admin_page_catalog, error_log_candidates, model_config}; actions search_started/tool_called/search_completed/search_error, all with request_id.
- Debugging abilities (list-log-issues, get-log-issue, read-source-excerpt, get-site-context): admin + Developer mode; read-source-excerpt 4 refusal gates.
- Comment AI scoring: nothing automatic; cron hook frozen but unscheduled.
- Mio /mio/turn: stateless single round, returns intents only, tools are window-private (not abilities), client dispatch.
- Agents share client/naming/normalization/model_config; do NOT fire openstation_ai_* search hooks; no request_id; own loop (8), 180s timeout (Copilot keeps Core 30s), rate limits (Copilot has none).
- DISCREPANCIES: filter-injected tools advertised but undispatchable; analyze-comment readonly so probably offered to search despite docs; ability doesn't write meta despite docs; hooks-reference "analyses on save" stale; source lists incomplete; 11th call wasted; no e2e test of run_search.

## UX + security (explorer 4)
- Three separate AI surfaces: Agents (/agents/{id}/invoke, can write), Copilot Cmd+K (/ai/search, readonly only, wp.os.ai.ask), Mio window (/mio/turn, client-side private tools). Cmd+K never invokes agents.
- 12 entry points: Chat button in WP Explorer detail, typing in chat window, CTA button, wizard "Create and chat", drag onto cast card, drag onto wallpaper agent tile, drag into open chat (NOT gated on drag trigger), right-click Send to (post/page/media/user; comments never map), double-click agent desktop tile, reopen past conversation, JS seed store + openWindow, PHP openstation_agent_invoke.
- Chat window: sidebar per-agent conversations, attachment card "Shared with the agent", status text Working/Queued/Background/Reconnecting, collapsible Tool calls (n), CTAs only on last message, markdown answers. Results only in transcript; no draft auto-opens.
- Wizard 5 steps: Describe (brief + "Draft it for me" via /agents/draft) -> Meet (faces, name, vibes) -> Powers (role + abilities, read-only/can modify badges) -> Summon (triggers) -> Launch (Create / Create and chat). Detail tabs Define/Tools/Triggers.
- Flag off: section still shown inert with preview cast + "Turn on Agents" (manage_options).
- No wp.os.agents namespace; public surface = shared store desktop-mode/agents-chat, window id desktop-mode-agent-run, action os.agents.roster-changed, filter os.my-wordpress.tile-context-menu.
- wp.os.ai.ask(query, {tools, followUp, systemPrompt, resumeTool, startOffset, commandContext, signal}); Cmd+K doesn't send command_tools; no in-tree aiCallable command; server slug regex rejects namespaced slugs.
- Security boundaries: 1 can't authenticate, 2 capability ceiling, 3 untrusted tool output fence, 4 granting role = granting caps. Plus rate limits, async job rechecks.
- Leak series (HackerOne/Wordfence OPENSTA-150..155): #801 search pw-protected + found_posts oracle, #803 get-post sealed body, #802 model-chosen entity_id, #804 comments on private parents / WooCommerce order notes, #805 comment dossier, #806 term stats counts, #811 user aggregates; codified #810. Root cause: status column read as authorization.
- readonly = blast-radius limit (what Copilot offers), not a gate; permission_callback is the gate since REST run / agent runner / Copilot all converge on WP_Ability::execute().
- Possible gaps (unverified): get-post lacks is_post_type_viewable; get-media only upload_files; triggers not authz; agent instructions readable by edit_posts users; history client-supplied; docs example passes no invoker.
- DRIFT: chat-store/jsref say session-only (actually server-persisted); #635 commit says 4 steps (code 5); rest/README missing rows for conversations, ai/status, mio/turn; ai/platform-settings row points to non-existent file.
