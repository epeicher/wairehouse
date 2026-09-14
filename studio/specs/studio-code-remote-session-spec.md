# Spec: `studio code` Remote Session (Telegram bridge)

## Overview

Add a "remote session" capability to the `studio code` CLI that lets the user drive `studio code` from Telegram. Each Telegram message arriving at the WordPress.com server is delivered to `studio code` as a new turn, and each assistant reply is posted back to Telegram.

The server side already exists. This spec covers only the local CLI changes.

## Goals

- One Telegram chat is bound to one resumable `studio code` session at a time. Each Telegram message resumes that session, runs one turn, and exits.
- The Telegram session shares history across messages (via `--resume`), and can be reset on demand.
- Two entry points to the same feature:
  - **Autostart flag**: `studio code --remote-session` enters remote mode immediately.
  - **Slash command**: `/remote-session attach|detach|new|status` toggles remote mode from inside an interactive `studio code` session.
- Fully autonomous: tool calls and file modifications proceed without per-message approval.
- Outbound-only network from the laptop (poll + post). No inbound ports, no tunnel, no PTY plumbing.

## Non-goals (v1)

- Multi-chat binding. v1 binds one chat per laptop, configured once.
- Per-message approval flow from Telegram.
- Forwarding intermediate progress events (tool calls, "Loading sites…") to Telegram. Only the final `result` text is posted.

## Server contract (already deployed)

Base URL: `https://public-api.wordpress.com/wpcom/v2/telegram-bot`

### `GET /local-agent-poll`

Headers: `Authorization: Bearer <token>`

Returns the next pending message for the local agent, or an empty body / `{}` when nothing is queued. The worker MUST handle an empty response by sleeping and retrying.

### `POST /local-agent-respond`

Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`

Body:
```json
{
  "chat_id": 236756880,
  "text": "Hello from local agent!",
  "bot": "my_test_bot"
}
```

Used for assistant replies and status messages.

## Reference: `studio code --json` event stream

A single invocation of `studio code --json "<prompt>"` emits an NDJSON stream on stdout and exits. The events relevant to this spec:

| Event | Field path | Meaning |
|---|---|---|
| `turn.started` | `type` | Turn has begun |
| `message` (`subtype: "init"`) | `message.session_id` | Capture this; reuse for `--resume` on subsequent turns |
| `message` (assistant text) | `message.message.content[].text` | Streamed assistant text (ignored — see below) |
| `message` (assistant tool_use, `name: "AskUserQuestion"`) | `message.message.content[].input` | **Structured question for the user** — flatten into Telegram text (see "Multi-turn flows") |
| `message` (assistant tool_use, other) | `message.message.content[].type == "tool_use"` | Ignored for v1 (don't forward to Telegram) |
| `progress` | `message` | Ignored for v1 |
| `message` (`type: "result"`, `subtype: "success"`) | `message.result` | **Final assistant text for the turn** — this is what gets posted to Telegram |
| `message` (`type: "result"`, `is_error: true`) | `message.result` | Error message for the turn |
| `turn.completed` | `status` | Process is about to exit; `status` is `success` or `error` |

The implementing agent MUST use the `result` event's `result` field as the canonical reply text. Do not stitch together streamed assistant chunks; the `result` field already contains the final assembled message.

## CLI surface

### Flag

```
studio code --remote-session [--remote-chat-id <id>] [--remote-bot <n>]
```

Behavior: start `studio code` in **remote-only** mode (no interactive REPL). The process is dedicated to running the poll loop. Equivalent to launching the poll loop directly with the configured chat binding.

This mode is intended for running under launchd or in a terminal tab dedicated to the bridge. It should not start the interactive UI.

### Slash command

Inside an interactive `studio code` session, register `/remote-session` with these subcommands:

```
/remote-session              # alias of `status`
/remote-session status       # show: attached?, chat_id, current session_id, last poll, queue depth
/remote-session attach       # start poll loop in the background; bind it to the configured chat
/remote-session detach       # stop poll loop; keep current Telegram session_id on disk
/remote-session new          # discard current Telegram session_id; next message starts fresh
```

Notes:
- `attach` starts a background task within the current `studio code` process. The user can keep using the interactive REPL while remote messages flow in parallel — they are independent sessions.
- The slash command is registered via the existing `slash_commands` mechanism shown in the `init` event.

### Telegram-side meta-command

Inside the poll loop, before forwarding a polled message to `studio code`, check if the message text equals `/new` (case-insensitive, trimmed). If so:
1. Discard the stored session_id.
2. POST `🆕 Started a new conversation.` to Telegram.
3. Continue polling without invoking `studio code`.

This gives the Telegram user a way to reset history without needing access to the laptop.

## Configuration

Read from, in priority order: CLI flags > environment variables > config file.

Config file: `~/.studio/remote-session.json`, mode `0600`.

```json
{
  "base_url": "https://public-api.wordpress.com/wpcom/v2/telegram-bot",
  "token": "...",
  "bot": "my_test_bot",
  "chat_id": 236756880,
  "poll_interval_seconds": 2,
  "long_poll_timeout_seconds": 25,
  "max_message_chars": 3800,
  "studio_code_binary": "studio",
  "turn_timeout_seconds": 300
}
```

Env var equivalents: `STUDIO_REMOTE_BASE_URL`, `STUDIO_REMOTE_TOKEN`, `STUDIO_REMOTE_BOT`, `STUDIO_REMOTE_CHAT_ID`.

The token MUST never be logged or echoed back to Telegram.

### Session state

Persisted separately from config: `~/.studio/remote-session-state.json`, mode `0600`.

```json
{
  "chat_id": 236756880,
  "session_id": "d09d3c77-c2a1-4a8e-81c9-d9f732da1412",
  "updated_at": "2026-04-22T09:31:29.003Z"
}
```

Written after each successful turn. Read on attach to resume.

## Architecture

```
┌──────────────────────────────────────────┐
│  studio code process                     │
│  (interactive OR --remote-session mode)  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ remote-session controller          │  │
│  │                                    │  │
│  │ ┌────────────────────────────────┐ │  │
│  │ │ poll loop                      │ │  │   GET /local-agent-poll
│  │ │   while attached:              │ │──┼──────────► server
│  │ │     msg = poll()               │ │  │   ◄──────── message
│  │ │     if msg.text == "/new":     │ │  │
│  │ │        clear session_id        │ │  │
│  │ │        ack to telegram         │ │  │
│  │ │        continue                │ │  │
│  │ │     reply = run_turn(msg.text) │ │  │
│  │ │     post(reply)                │ │  │   POST /local-agent-respond
│  │ │                                │ │──┼──────────► server
│  │ └─────────┬──────────────────────┘ │  │
│  │           │                        │  │
│  │           ▼                        │  │
│  │ ┌────────────────────────────────┐ │  │
│  │ │ run_turn(text):                │ │  │
│  │ │   spawn: studio code --json    │ │──┼──► spawn child
│  │ │     [--resume <session_id>]    │ │  │    (one per turn,
│  │ │     "<text>"                   │ │  │     exits at turn.completed)
│  │ │   parse NDJSON from stdout     │ │  │
│  │ │   capture session_id from init │ │  │
│  │ │   capture result.result text   │ │  │
│  │ │   persist session_id           │ │  │
│  │ │   return result text           │ │  │
│  │ └────────────────────────────────┘ │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

Three responsibilities, all owned by the controller:

1. **Poll loop** — drives the lifecycle, polls the server, handles `/new`, posts replies.
2. **Turn runner** — spawns one `studio code --json` per Telegram message, parses events, returns the final text.
3. **State manager** — reads/writes the session_id to disk; clears it on `/new` or `/remote-session new`.

No PTY, no long-lived child, no shared state between processes. The session_id on disk is the entire state.

## Lifecycle

### Attach (from flag or `/remote-session attach`)

1. Validate config (token, bot, chat_id present). On failure, exit non-zero with a clear local error naming the missing fields. Do not retry.
2. Load state file; capture any existing `session_id` for the configured chat.
3. POST status to Telegram: `🟢 Local agent attached. Working dir: <cwd>. <resume_note>` where `<resume_note>` is `Resuming previous session.` if a session_id was loaded, else `New session.`. If the POST fails, abort attach and surface the error locally.
4. Set state to `attached`. Start the poll loop.
5. Print to local terminal: `Remote session attached → chat <chat_id>.`

### Poll loop

```
while attached:
    try:
        msg = GET /local-agent-poll  (long-poll, timeout = long_poll_timeout_seconds)
        if msg is empty:
            sleep(poll_interval_seconds)
            continue

        if msg.chat_id != config.chat_id:
            log_warning("ignoring message for chat {msg.chat_id}; bound to {config.chat_id}")
            continue

        text = msg.text.strip()

        if text.lower() == "/new":
            clear_session_id()
            post_to_telegram("🆕 Started a new conversation.")
            continue

        reply = run_turn(text, turn_timeout_seconds)
        if reply is None:
            post_to_telegram("⚠️ Local agent did not return a result.")
            continue

        post_chunks_to_telegram(reply)

    except network_error:
        sleep(backoff)  # exponential, cap 30s
    except auth_error (401/403):
        post_to_telegram("⚠️ Bad token; detaching.")  # best-effort
        detach()
        break
    except fatal:
        log(error)
        detach()
        break
```

### `run_turn(text, timeout)`

1. Build command: `[studio_code_binary, "code", "--json"]`. If a stored `session_id` exists for this chat, append `["--resume", session_id]`. Append `text` as the final positional argument.
2. Spawn the child with stdout piped, stderr captured to a log buffer, cwd inherited from the controller's process.
3. Read stdout line-by-line as NDJSON. For each line:
   - If `type == "message"` and `message.subtype == "init"`: capture `message.session_id`. (Only useful for the very first turn before any session has been stored, but always capture so we self-heal if the on-disk session_id is invalid.)
   - If `type == "message"` and `message.type == "result"`:
     - If `subtype == "success"`: capture `message.result` as the reply.
     - Else: capture `message.result` as an error reply prefixed with `⚠️ `.
   - If `type == "turn.completed"`: stop reading.
4. Wait for the child to exit. If it does not exit within 5s after `turn.completed`, SIGTERM, then SIGKILL after 2s more.
5. If the child times out (exceeds `turn_timeout_seconds` overall): SIGTERM, then SIGKILL after 2s. Return `None`.
6. If the captured `session_id` differs from the on-disk one (or none was on disk), persist it to the state file.
7. Return the captured reply text.

### Detach (from `/remote-session detach` or fatal error)

1. Set state to `detached`. Poll loop exits at next iteration boundary.
2. POST `🔴 Local agent detached.` to Telegram.
3. Print to local terminal: `Remote session detached.`
4. Leave the session_id on disk so a future attach resumes seamlessly.

### `/remote-session new`

1. Clear the session_id from disk.
2. POST `🆕 Started a new conversation.` to Telegram.
3. Print to local terminal: `Remote session reset.`
4. Continue polling normally.

### Process exit

- Parent process exit while attached: best-effort POST `🔴 Local agent ended (process exit).` (timeout 2s, do not block exit). Leave session_id intact.

## Reply handling

### Capturing the reply

For most turns, the reply is the `result` field of the `result` message. Do not concatenate the `assistant` `text` blocks — the `result` field already contains the final assembled text and is what the user sees in the interactive UI.

For turns that end with an `AskUserQuestion` tool call, follow the algorithm in "Multi-turn flows → Reply extraction with AskUserQuestion." The short version: if the agent asks a structured question, synthesize the Telegram reply from the tool input rather than relying on the `result` field, which may be empty.

If after both checks no text was captured, return `None`.

### Chunking

Telegram caps message bodies at 4096 chars. Use `max_message_chars` (default 3800).

- Split on paragraph boundaries (`\n\n`) first, then sentence boundaries, then hard wrap.
- Code blocks (` ``` `) MUST NOT be split mid-block. If a single code block exceeds the limit, split it into multiple labeled blocks: `(part N/M)`.
- Each chunk is one POST to `/local-agent-respond`, awaiting 200 OK before sending the next, to preserve order.

### Markdown handling

`studio code` returns Markdown. Pass through unchanged in v1; the server-side already handles Markdown→Telegram-HTML conversion for the existing Dolly path. The implementing agent MUST verify this against the `/local-agent-respond` endpoint before coding (open question 1 below).

If conversion is NOT done server-side, do minimal local processing: strip ANSI escape codes, leave Markdown as-is.

## Multi-turn flows

The agent can ask the Telegram user a question mid-flow and wait for an answer. This works automatically because each polled Telegram message resumes the same session via `--resume <session_id>`. From the controller's perspective, every turn is the same: spawn → parse → post → exit.

There are two patterns the agent uses:

### Pattern 1: Plain-text question

The agent simply asks a question in its `result` text. Example: a skill instructs the agent to ask "What's the name of your Rubik's Cube club?" in plain text and stop. The turn completes successfully with the question as `result`. No special handling needed — the controller posts it to Telegram, the user replies, and the next polled message becomes the next turn's prompt within the same resumed session.

### Pattern 2: Structured `AskUserQuestion` tool call

The agent calls the `AskUserQuestion` tool (visible in the `init` event's `tools` array). In `--json` mode this completes the turn cleanly: the `tool_use` event carries the question and option labels, and the turn ends with `status: "success"`. The next polled message is treated as the answer.

`AskUserQuestion` input shape (per the `studio:site-spec` skill: 1–4 questions per call, 2–4 options each, with an automatic "Other" free-form option):

```json
{
  "questions": [
    {
      "question": "One-page site or multi-page site?",
      "options": ["One-page", "Multi-page"]
    }
  ]
}
```

The implementing agent MUST run a single test call (e.g., a prompt that triggers `studio:site-spec` round 2) to confirm the exact field names before coding the parser.

### Flattening `AskUserQuestion` for Telegram

When the controller sees a `tool_use` event for `AskUserQuestion`, it MUST format the question(s) as Markdown and post them to Telegram, since Telegram cannot render the structured picker.

Format for a single question:

```
**<question text>**

- A) <option 1>
- B) <option 2>
- C) <option 3>
- _Or reply with anything else for "Other"._
```

For multiple questions in one call, number them and ask the user to reply with one answer per line (or any free-form text — the agent will parse it on the next turn).

The user's free-form reply is sent verbatim as the next turn's prompt. The agent in the resumed session sees the answer in conversation context and continues. The controller does NOT try to parse the user's answer or map it back to option indices — that's the agent's job.

### Reply extraction with `AskUserQuestion`

When a turn ends with an `AskUserQuestion` `tool_use` and the `result` field is empty or doesn't contain the question text, the controller MUST synthesize the reply from the tool input rather than posting "Local agent did not return a result."

Algorithm for extracting the final reply text:

1. If `result` event has non-empty `result` field AND no `AskUserQuestion` tool_use was seen in the turn → use `result.result`.
2. If an `AskUserQuestion` tool_use was seen → format its `input` as Markdown per above. If `result.result` is also non-empty (the agent wrote some lead-in text before calling the tool), prepend it.
3. Otherwise fall back to concatenating any `assistant` text content blocks.
4. If still empty, return `None`.

### No "waiting" state

The controller does NOT track whether the agent is "waiting on the user." It just polls and resumes. The Telegram user replies naturally; the conversation continues. This keeps the design stateless beyond the on-disk session_id.



| Condition | Behavior |
|---|---|
| Poll returns 401/403 | Post `⚠️ Bad token; detaching.`, detach, exit non-zero |
| Poll returns 5xx | Exponential backoff, cap 30s, keep trying |
| Poll network timeout | Treat as empty, continue |
| Respond returns 4xx | Log locally, do NOT retry (likely malformed payload). Continue polling. |
| Respond returns 5xx | Retry up to 3x with backoff, then drop and log. Continue polling. |
| `studio code` exits non-zero | Capture stderr, post `⚠️ Local agent error: <stderr first 500 chars>` to Telegram, continue polling |
| `run_turn` timeout | Kill child, post `⚠️ Turn took too long; aborted.`, continue polling |
| `run_turn` returns no `result` event | Post `⚠️ Local agent did not return a result.`, continue polling |
| `--resume <id>` fails (invalid/expired session) | Detect via stderr or non-zero exit, clear session_id, retry the turn once with no `--resume` flag, post `ℹ️ Session expired; started a new one.` |

All user-visible errors MUST NOT include the bearer token or full URLs containing it.

## Concurrency

- One in-flight turn at a time. While `run_turn` is running, the poll loop blocks. This matches the server-side per-chat lock.
- The slash command handler and the poll loop both touch the `attached` flag; guard with whatever sync primitive the existing codebase uses.

## Logging

Log file: `~/.studio/remote-session.log`, rotated at 10MB, keep 3.

INFO-level events: attach, detach, `/new`, each polled message (chat_id and first 80 chars of text), each spawned turn (with `session_id`, duration_ms, output_chars), each respond call (chunk count and char total), all errors with redacted URLs.

DEBUG-level (only when `STUDIO_REMOTE_DEBUG=1`): full request/response bodies with token redacted, full NDJSON event stream from the child.

## Security checklist

- [ ] Token never written to log files in cleartext.
- [ ] Token never sent in any Telegram message body.
- [ ] Config file and state file created with mode `0600`.
- [ ] Polled message text is only ever passed as a positional argv to `studio code` — never interpolated into a shell string. Use `execve`-style spawning, not `system()` or `sh -c`.
- [ ] Network calls go only to the configured `base_url` host. Reject redirects to other hosts.
- [ ] No retry of inbound polled messages — once polled, a dropped message is dropped (server can re-send if needed).

## Acceptance criteria

1. `studio code --remote-session` starts a process that immediately POSTs the "attached" status to Telegram and begins polling. No interactive UI is shown.
2. From an interactive `studio code` session, `/remote-session attach` starts the poll loop in the background; the user can continue typing locally while remote messages are processed in parallel.
3. A Telegram message routed to the local agent appears in the chat as a reply within `poll_interval + studio_code_turn_duration + ~2s` end-to-end.
4. The second and subsequent Telegram messages are processed in the **same** `studio code` session (verified by the agent referring back to earlier turns).
5. `/remote-session new` (laptop) and `/new` (Telegram) both reset the session; the next message starts fresh and the agent has no memory of prior turns.
6. `/remote-session detach` stops polling and posts a detach status; on a later `/remote-session attach`, the same session resumes.
7. Replies longer than 4096 characters are split into multiple Telegram messages in order, with code blocks intact.
8. Killing the `studio code` process while attached posts a best-effort detach status to Telegram and leaves the session_id intact for the next attach.
9. With an invalid token, attach fails fast with a clear local error and does NOT enter a retry loop.
10. While a turn is being processed, no new poll request is made until the reply has been posted (or the turn has timed out).
11. If `--resume` fails because the session is stale, the controller silently retries with a fresh session and posts a one-line notice to Telegram.
12. The token does not appear in any log line, error message, or Telegram message under any tested condition.
13. The polled message text cannot trigger shell injection — verified by sending a message containing `; rm -rf /tmp/test-canary` (with a sentinel file in place) and confirming the file remains.
14. Multi-turn flow works end-to-end: send "Create a site for my Rubik's Cube club" via Telegram → agent asks for the club name in plain text → user replies with a name → agent asks the one-page-vs-multi-page question (likely via `AskUserQuestion`, rendered as Markdown options in Telegram) → user replies with their choice → agent calls `site_create` and reports completion. All turns share the same `session_id`.

## Open questions for the implementing agent to resolve

1. Confirm whether `/local-agent-respond` accepts Markdown and converts to Telegram HTML, or expects pre-formatted HTML. (Check against the existing Telegram channel response path on the server.)
2. Confirm the exact resume flag for `studio code --json` (`--resume <id>`, `--session <id>`, etc.) by running `studio code --help`.
3. Confirm the exact response shape of `/local-agent-poll`: field names for chat_id / text / bot, and how "no message" is represented (empty body, `null`, `{}`, or `{"message": null}`).
4. Confirm whether `studio code` writes anything to stderr during normal `--json` operation that the controller should ignore vs. capture as an error indicator.
5. Confirm the exact `AskUserQuestion` tool input schema by triggering a multi-question skill (e.g., `studio:site-spec` round 2) and inspecting the `tool_use` event's `input` field. Specifically: the field name for the questions array, the field name for the options array, and whether each option is a plain string or an object.
