# MCP Onboarding Coach — Design

## Context

Chaos Dimension already ships a polished `/connect` page (`src/pages/Connect.jsx`) with ClaudeCard, ChatGptCard, and ClaudeCodeCard sections — OAuth Dynamic Client Registration, live verification polling, the works. What's missing is anything that *proactively shepherds* a new signed-in user toward connecting an AI and seeing MCP work end-to-end.

New users today land on the empty kanban board with no nudge toward the dashboard's whole point: dispatching work to an AI agent over MCP. This design adds a small, persistent in-app coach that surfaces two activation milestones and auto-disappears the moment the user achieves them.

The coach is intentionally narrow — MCP-connection and one proof-of-life roundtrip — not a general "getting started" checklist. The goal is activation, not feature tourism.

## Component

A new `src/components/OnboardingCoach.jsx`:

- Small Mac OS 7 window, ~280×210px, fixed to the dashboard's bottom-right (margin 16px).
- Uses existing `MacWindow.jsx` chrome — striped title bar, close box top-left, sharp-corner border (matches `AboutDialog.jsx`).
- Title: **"Getting Started"**.
- Draggable via title bar (local `useState` for position if `MacWindow` doesn't already expose this).
- Z-index: **100** — above kanban (50), below modals (300).
- Footer: small "Don't show again" link, theme `textDim`.

Mounted in `src/pages/App.jsx` and rendered only when `mode === 'live'` (never on the demo landing).

## State and trigger

Per-user state, three pieces:

| Field | Source | Meaning |
|---|---|---|
| `coach_dismissed` | new column on `users` table, default `false` | User clicked "Don't show again" or coach auto-closed after success |
| `has_connected_ai` | derived | At least one OAuth MCP client OR one issued agent token exists for this user |
| `has_mcp_created_task` | derived | At least one task for this user has `created_via = 'mcp'` |

Coach renders when `!coach_dismissed && !(has_connected_ai && has_mcp_created_task)`. So:

- Brand-new user: shown.
- User who connected Claude but hasn't roundtripped a task yet: shown (item 1 ✓, item 2 empty).
- User who has done both: not shown (auto-dismissed on completion).
- User who clicked "Don't show again": not shown until they re-open from Help menu.

A new menu item **Help → Getting Started…** sets `coach_dismissed = false` and re-opens the coach for users who want it back.

## Backend changes

1. **`users` table**: add `coach_dismissed BOOLEAN NOT NULL DEFAULT FALSE`.
2. **`tasks` table**: add `created_via TEXT NOT NULL DEFAULT 'ui'` (values: `'ui'`, `'mcp'`).
3. **`api/mcp.js`**: in the `create_task` tool handler, set `created_via = 'mcp'` on the inserted row.
4. **New endpoint** `GET /api/me/onboarding` returning:
   ```json
   { "coach_dismissed": false, "has_connected_ai": true, "has_mcp_created_task": false }
   ```
   Derives `has_connected_ai` by checking for any row in the OAuth clients table OR agent tokens table tied to the user.
   Derives `has_mcp_created_task` by `SELECT EXISTS(SELECT 1 FROM tasks WHERE user_id = $1 AND created_via = 'mcp')`.
5. **New endpoint** `POST /api/me/onboarding/dismiss` setting `coach_dismissed = true`.
6. **New endpoint** `POST /api/me/onboarding/reset` setting `coach_dismissed = false` (called by the Help menu item).

## Checklist items

Two rows. Each is an inset panel (2px inset border, 8px padding) with a 12×12 sharp-corner checkbox indicator on the left.

### Item 1 — Connect an AI

Collapsible. Expanded by default until checked. Inside, three flat segmented tabs (active = inverted, matching kanban column headers — no rounded-top "modern" tabs):

- **Claude** *(default tab)*
  - Copy: *"Works with Claude Pro, Max, Team, or Enterprise (custom connectors). Free works too via Claude Desktop or Claude Code below."*
  - Button (`.mac-btn-primary`): **"Open Claude setup →"** — navigates to `/connect#claude`.

- **ChatGPT**
  - Copy: *"Works with ChatGPT Plus, Pro, Business, Enterprise, or Edu (custom connectors). Free tier doesn't support MCP connectors yet."*
  - Button: **"Open ChatGPT setup →"** — `/connect#chatgpt`.

- **Claude Code**
  - Copy: *"Any plan. Run `claude mcp add chaos-dimension …` — full command on the setup page."*
  - Button: **"Open Claude Code setup →"** — `/connect#claude-code`.

When `has_connected_ai = true`, the row collapses to a single line: `✓ Connect an AI`.

### Item 2 — Ask your AI to create a task

Not collapsible. Single body:

> *"In Claude or ChatGPT, try: 'Create a task in Chaos Dimension called Test from Claude in the second-seat workstream.' When you see it appear on the board, you're done."*

Small ⚡ icon next to the example, matching the existing agent-dispatchable convention from CLAUDE.md. No button — the action happens in the user's AI client.

When `has_mcp_created_task = true`, collapses to `✓ Ask your AI to create a task`.

## Auto-detection

Both items tick without user clicks:

- Poll `GET /api/me/onboarding` every **10 seconds** while the coach is mounted and visible. Polling stops when the coach is closed (dismissed, auto-closed, or after the user navigates away from `/app`). Matches the existing live-verification cadence on `/connect`.
- When `has_connected_ai` flips true → item 1 collapses to ✓.
- When `has_mcp_created_task` flips true → item 2 collapses to ✓.
- When both are ✓: render a brief celebratory line *"You're set up. ✨"* for ~3 seconds, then auto-close the coach and `POST /api/me/onboarding/dismiss`.

## Visual chrome

- Title bar: existing `MacWindow` striped pattern, "Getting Started" centered, close box top-left (matches `AboutDialog`).
- Body background: theme `MAC.windowBg`.
- Checkbox indicator: 12×12 outset border square. Checked: same square with a `✓` glyph (Chicago/Geneva fallback chain via theme `FONT`).
- Buttons: existing `.mac-btn` and `.mac-btn-primary` — no new styles.
- Tabs: flat segmented buttons (active = inverted colors), NOT rounded-top tabs. Matches kanban column headers.
- Text colors: theme `text` for primary copy, `textDim` for the "Don't show again" footer and the "Free works too…" hint copy.
- No rounded corners, gradients, or shadows — preserve the System 7 aesthetic per CLAUDE.md.

## Files touched

| Path | Change |
|---|---|
| `src/components/OnboardingCoach.jsx` | **NEW** — the coach window component |
| `src/pages/App.jsx` | Mount `<OnboardingCoach />` when `mode === 'live'` |
| `src/components/MenuBar.jsx` | Add "Help → Getting Started…" item that POSTs to `/api/me/onboarding/reset` and re-opens the coach |
| `api/me/onboarding.js` | **NEW** — handles `GET /api/me/onboarding`, `POST /api/me/onboarding/dismiss`, `POST /api/me/onboarding/reset` |
| `api/mcp.js` | Set `created_via = 'mcp'` in `create_task` handler |
| `db/migrations/<next>_onboarding.sql` | Add `users.coach_dismissed` + `tasks.created_via` columns |

## Verification

Manual end-to-end on a fresh account:

1. Sign up a new user. Coach appears in the BR of `/app` with both items unchecked.
2. Open `/connect`, complete the Claude OAuth flow. Within 10s, item 1 ticks ✓ and collapses.
3. From a real Claude or ChatGPT session connected to the user's account, ask it to create a task. Within seconds, the task appears on the kanban *and* item 2 ticks ✓.
4. ~3s after the second tick, the coach auto-closes. `coach_dismissed` is now true. Reloading the app does not re-open it.
5. Click **Help → Getting Started…**. Coach re-opens, both items are still ✓ (state is persisted). Closing it again sets dismissed back.
6. Click "Don't show again" before completing either item. Coach disappears, does not return on reload, returns only via Help menu.

Automated:

- Unit test for the `has_connected_ai` / `has_mcp_created_task` derivation in the new endpoint (using a test DB with seeded rows).
- Integration test: hit `api/mcp.js`'s `create_task` and assert the inserted row has `created_via = 'mcp'`.
