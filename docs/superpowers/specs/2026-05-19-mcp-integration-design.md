# Chaos Dimension MCP Integration — Design Spec

**Status:** Approved
**Date:** 2026-05-19
**Target:** v0.4 — MCP server + agent-identity API keys + auto-tracking prompt pattern

## Context

Chaos Dimension currently models tasks, workstreams, and agents in its DB but has no real connection to coding agents. The Agent Monitor is theater. v0.4 wires Claude Code (and any MCP-capable agent) into the dashboard via the **Model Context Protocol**.

The driving use case: a user runs Claude Code normally (`cd ~/code/legal-ai-stuff && claude`), gives ad-hoc coding instructions, and Chaos Dimension stays in sync as a living journal of work — not just a planning board.

Hooks (file-based or HTTP) were considered and deferred. MCP wins for v1 because it's bidirectional (Claude can both read CD state and write to it), it's intentional (Claude calls tools deliberately, not on every stray edit), and it makes "affiliate work to workstreams" explicit rather than inferred.

## Goals

1. Claude Code (and other MCP clients) can read and write Chaos Dimension state.
2. Each Claude install is an identifiable agent on the dashboard (laptop, desktop, etc.).
3. A natural "use Claude normally → Claude auto-creates tasks with user confirmation" pattern emerges from prompt configuration, not new tools.
4. Graceful degradation: MCP failures never block Claude's main work.
5. Quota footprint stays in free-tier territory at hobby scale.

## Non-Goals (Deferred)

- Hook-based passive activity reporting (every tool call → server). v2.
- WebSocket/SSE streaming to the dashboard. v2 (today: dashboard polls or user refreshes).
- Workstream CRUD via MCP. Workstreams stay managed in the web UI; MCP only reads them.
- Agent CRUD via MCP. Agents are provisioned implicitly when an API key is created.
- Multi-user permissions / sharing. Single-user assumption holds.
- A Settings → API Keys UI. v0.4.1 follow-up; for v0.4 we generate keys via a CLI script (`npm run mint-api-key`).

## Architecture Overview

```
┌─────────────────────┐         HTTPS + Bearer auth         ┌──────────────────────┐
│  Claude Code        │ ─────────────────────────────────►  │  Vercel deployment   │
│  (~/.claude/.mcp.   │                                     │  /api/mcp (new)      │
│   json points to    │  ◄──── streamable HTTP MCP ────►   │  /api/agent-tokens   │
│   chaosdimension.   │                                     │  (existing /api/*)   │
│   fyi/api/mcp)      │                                     │                      │
└─────────────────────┘                                     │  Drizzle ORM         │
                                                            │      │               │
                                                            │      ▼               │
                                                            │  Neon Postgres       │
                                                            │  (tasks, agents,     │
                                                            │   workstreams,       │
                                                            │   agent_tokens NEW)  │
                                                            └──────────────────────┘
```

- MCP transport: **Streamable HTTP** (modern MCP transport, works fine on Vercel serverless functions).
- Auth: `Authorization: Bearer <token>` headers. Each token maps to an agent row.
- The MCP handler reuses the existing Drizzle queries; the API logic is the same code paths that `/api/tasks` and `/api/workstreams` use.

## New / Modified Schema

### New table: `agent_tokens`

```
id          text primary key (cuid)
agent_id    text not null references agents.id on delete cascade
token_hash  text not null         -- sha256 of the raw token; raw never stored
label       text not null         -- human-readable, e.g. "macbook"
createdAt   timestamp default now()
lastUsedAt  timestamp
revoked     boolean default false
```

Raw tokens are shown **once** at creation time, then discarded. We store only `token_hash`. Auth lookup: hash the incoming Bearer token, find the row, check `revoked = false`.

### Modified: `agents` table

Add columns (nullable so existing rows aren't broken):

```
hostname    text                   -- agent self-identifies host, set on token creation
createdAt   timestamp default now()
```

Existing agents (claude-alpha/bravo/charlie) stay as-is. New agents created when minting a token.

## MCP Tool Surface (v1)

Seven tools. Each is a thin wrapper over existing Drizzle queries.

### Read tools

| Tool | Input schema | Output |
|---|---|---|
| `list_workstreams` | none | `[{ id, label, color, icon }]` |
| `list_tasks` | `{ workstream?, column?, priority?, limit?=20 }` | `[{ id, title, workstream, column, priority, agentDispatchable, notes, ...}]` |
| `get_task` | `{ id }` | One task row |

### Write tools

| Tool | Input schema | Behavior |
|---|---|---|
| `create_task` | `{ title, workstream, column?='backlog', priority?='med', notes?='', agentDispatchable?=false }` | Inserts a task. Returns the row. |
| `update_task` | `{ id, title?, workstream?, column?, priority?, notes?, agentDispatchable? }` | Patches allowed fields. Returns updated row. |
| `claim_task` | `{ id }` | Convenience for `update_task(id, { column: 'active' })` + records this agent on the agents table (`taskId`, `status='running'`, `startedAt=now`). |
| `report_progress` | `{ id, message }` | Reads task's notes, appends `[HH:MM] message`, saves. Also appends to the calling agent's `log` array. |

### Tool design principles

- All write tools are idempotent where reasonable (`claim_task` of an already-claimed task is a no-op-with-success).
- Validation matches existing REST handlers (title required, workstream must exist, etc.).
- Errors return MCP-protocol error responses with `{ error: 'kind', message: 'human-readable' }` matching the new structured-error pattern.
- The MCP handler **wraps every tool call in `withErrors`** (the existing helper from `src/lib/apiHandler.js`). Same DRY pattern as REST routes.

## Auto-Tracking Behavior (Prompt-Driven)

No new MCP tools. The behavior comes from a recommended CLAUDE.md snippet:

```markdown
## Chaos Dimension tracking

You have access to chaos-dimension MCP tools. Use them to keep work tracked.

When the user gives a non-trivial coding instruction:
1. Call list_workstreams + list_tasks to check if it's already tracked.
2. If not, ask the user: "Want me to track this as a task in <inferred workstream>?"
3. If yes, call create_task then claim_task.
4. While working, call report_progress periodically with concise updates.
5. When done, call update_task with column='review' (or 'done' if no review needed).

Skip tracking for trivial edits (typos, one-line fixes, exploration).

To disable tracking in this project, set CHAOS_TRACK=off in the environment or
remove this section from CLAUDE.md.
```

Users opt into auto-tracking per-project by including this snippet in their CLAUDE.md. We'll ship a copy in `docs/integration/CLAUDE.md.snippet`.

## Auth Flow

### Minting a token (one-time per machine)

For v0.4, no UI. A new npm script:

```bash
npm run mint-api-key -- --label macbook
```

This script:
1. Authenticates via the same `CHAOS_PASSWORD_HASH` mechanism (`prompt for password`).
2. Hits a new endpoint `POST /api/agent-tokens` with the label.
3. Server creates an `agents` row (if one with this label doesn't exist) and a new `agent_tokens` row with a fresh random token.
4. Returns the raw token (in the response body) — shown to the user **once**.
5. User pastes the token into `~/.claude/.mcp.json`.

Token format: 32-byte URL-safe random string, prefixed `cd_` for identifiability (`cd_<43chars>`).

A future v0.4.1 will move this to a web UI.

### Token verification

Every MCP request:
1. Extract `Authorization: Bearer <token>`.
2. Hash with sha256.
3. Look up `agent_tokens` row by `token_hash`.
4. Reject (401) if missing or `revoked = true`.
5. Attach `agent_id` to request context for tools that need to know who's calling.

Time-constant compare not needed since we look up by exact hash.

### Token revocation

Same npm script with `--revoke <label>` flag. Marks `revoked = true`. Operations from that token instantly fail with 401.

## API Surface Additions

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/mcp` | POST (Streamable HTTP) | Bearer token | MCP transport endpoint |
| `/api/agent-tokens` | POST | session cookie (web UI) | Mint a new token |
| `/api/agent-tokens` | GET | session cookie | List tokens (label, lastUsedAt, revoked) |
| `/api/agent-tokens/[id]` | DELETE | session cookie | Revoke a token |

The MCP route is bearer-auth, the management routes are cookie-auth.

## Failure Modes & Graceful Degradation

| Failure | Effect | Mitigation |
|---|---|---|
| Network unreachable | MCP tool calls hang/fail | Claude reports "CD unreachable, proceeding untracked", continues |
| Token revoked | 401 on every call | Claude reports auth failure, continues untracked |
| Server 5xx (Neon down, etc.) | Tool calls error | Claude continues untracked |
| Latency spike (cold start) | One slow tool call | Claude waits up to ~5s, no retries — proceeds either way |
| Tool input validation error | 400 with message | Claude sees the error message, tries to fix or asks user |

The prompt snippet should explicitly tell Claude not to retry MCP calls on network errors more than once — fail open and continue working.

## Folder Additions

```
/api/
  mcp.js                      MCP streamable-HTTP transport handler
  agent-tokens/
    index.js                  POST (mint), GET (list)
    [id].js                   DELETE (revoke)

src/db/schema.js              Add agent_tokens table + new fields on agents

src/lib/
  mcpTools.js                 Tool registry + handlers (one per tool)
  agentToken.js               hashing, lookup, mint helpers

scripts/
  mint-api-key.js             CLI for token minting

docs/integration/
  CLAUDE.md.snippet           Recommended prompt block for users to copy
  README.md                   Setup instructions: install snippet + mint key + edit .mcp.json
```

## Testing Strategy

- **Unit**: `src/lib/agentToken.js` (hash, verify); `src/lib/mcpTools.js` (each tool's pure logic against a mocked db).
- **Integration**: One MCP smoke test that exercises the full request → tool dispatch → DB round-trip against a Neon dev branch.
- **Manual**: Mint a token locally, point Claude Code at `chaosdimension.fyi/api/mcp`, run through the full auto-track flow once.

## Deploy Story

1. Migration: `npm run db:generate && npm run db:push` for the new table + columns.
2. Vercel auto-deploys on push to main.
3. User mints their first token via `npm run mint-api-key`.
4. User adds the chaos-dimension entry to `~/.claude/.mcp.json` (sample in `docs/integration/README.md`).
5. User pastes the CLAUDE.md snippet into projects where they want auto-tracking.

## Performance & Quota

- Per-tool-call latency: 100–300ms warm, 500–700ms cold.
- Per-task overhead: 5–7 tool calls ≈ 1–2s aggregated.
- Vercel function invocations at hobby use: ~1.5k/month (~1.5% of free tier).
- Neon compute: negligible (millisecond queries).

## Open Questions

None — locked during brainstorming.

## Future Work (v0.4.1+)

- Settings → API Keys management UI (replaces the npm script).
- Hook-based passive activity reporting alongside MCP.
- SSE/WebSocket push to dashboard for real-time updates.
- `mark_review` / `mark_done` convenience tools (currently done via `update_task`).
- Workstream auto-creation via MCP (currently web-UI only).
- Cross-machine agent identity reconciliation (one user, multiple laptops claiming same task).
- AIM Messenger feature (Task 28, separate scope).
