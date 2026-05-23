# Chaos Dimension MCP — Setup

> **Signed in to a hosted instance?** The dashboard's **Connect AI** menu walks you through Claude Code, Claude Desktop / claude.ai, and ChatGPT setup interactively — including a live verify panel that flips green when the client actually connects. This document is the canonical reference; the menu is the easy mode.

Connect Claude Code (or any MCP client) to your Chaos Dimension deployment.

## One-time per machine

### Step 1: Mint a token

From a clone of this repo with a populated `.env.local` (DATABASE_URL):

```bash
npm run mint-api-key -- --label macbook
```

The script prints a JSON block. Copy the `cd_xxx...` token from it. **The raw token is shown once. Don't lose it.**

### Step 2: Register the MCP server with Claude Code

**Easiest path — use the Claude Code CLI:**

```bash
claude mcp add --transport http chaos-dimension https://www.chaosdimension.fyi/api/mcp --header "Authorization: Bearer cd_paste-your-token-here"
```

This writes the config in the right place with the right format.

**Manual alternative.** Open `~/.claude.json` (note: a single dotfile, not `~/.claude/.mcp.json`) and add this entry under the `mcpServers` key (creating the key if missing):

```json
{
  "mcpServers": {
    "chaos-dimension": {
      "type": "http",
      "url": "https://www.chaosdimension.fyi/api/mcp",
      "headers": {
        "Authorization": "Bearer cd_paste-your-token-here"
      }
    }
  }
}
```

The `"type": "http"` field is required — without it, Claude Code doesn't know how to talk to the server. Don't replace the file if other settings already exist; add `mcpServers` as a sibling key.

For a per-project config instead, put the same JSON in a `.mcp.json` file at your project root.

### Step 3: Restart Claude Code, verify

Fully quit any running Claude Code sessions and start a new one. Inside it, run:

```
/mcp
```

You should see `chaos-dimension` listed as connected with 7 tools. If it shows pending or failed, the most common causes are: token typo, token revoked, or the deploy hasn't picked up the new schema.

The seven tools: `list_workstreams`, `list_tasks`, `get_task`, `create_task`, `update_task`, `claim_task`, `report_progress`.

## Enabling auto-tracking in a project

Drop the snippet from `CLAUDE.md.snippet` into your project's `CLAUDE.md` (or your global `~/.claude/CLAUDE.md`). Claude will start asking before creating tasks for non-trivial work.

## Revoking a token

For v0.4 there's no dashboard UI yet. You can revoke via curl using your browser session cookie:

```bash
# Grab a session cookie from your browser (DevTools -> Application -> Cookies -> chaos_session)
COOKIE="chaos_session=..."

# List tokens to find the id
curl https://chaosdimension.fyi/api/agent-tokens -H "Cookie: $COOKIE"

# Revoke one
curl -X DELETE https://chaosdimension.fyi/api/agent-tokens/<id> -H "Cookie: $COOKIE"
```

A token-management UI is coming in v0.4.1.

## Lost a token

Mint a new one with a different label (`--label macbook-2`). The old token can be revoked when you have a moment.

## Why this is bidirectional

The MCP server lets Claude both *read* CD state (`list_tasks`, `list_workstreams`) and *write* it (`create_task`, `claim_task`, `report_progress`, `update_task`). The combination is what enables the auto-tracking pattern in the CLAUDE.md snippet.

## Connecting Claude Desktop / claude.ai web

The MCP endpoint also speaks OAuth 2.1 with Dynamic Client Registration, so the connector UI in Claude Desktop and claude.ai can register itself — no token minting required:

1. Settings → Connectors → **Add custom connector**.
2. **URL:** `https://www.your-deploy.fyi/api/mcp` (replace with your deploy host — use the `www.` form if your apex redirects there).
3. Leave OAuth Client ID and Client Secret blank.
4. Click **Add**. A browser tab opens to your dashboard for password login + consent. Approve, and the connector lights up.

Each consenting client gets a synthetic "agent" row in the dashboard (named after the OAuth client) so progress reports from Desktop/web show up in the Agent Monitor alongside agents dispatched from Claude Code.

### OAuth troubleshooting

- **"invalid_redirect_uri"** — the redirect URI in the connector setup must exactly match one of the URIs the client sent during registration. Remove the connector and add it again to re-register.
- **Stuck on the consent page** — make sure you're logged into the dashboard in the same browser. The consent page calls `/api/oauth/authorize/pending`, which requires the `chaos_session` cookie.
- **Connector reports "invalid_grant" after some time** — the access token is 1h. Claude should refresh automatically; if it doesn't, remove and re-add the connector. Reusing a refresh token (or an authorization code) revokes the entire token chain for that client by design.
- **Bearer `cd_...` agent-token from Claude Code stops working** — OAuth runs in parallel and never touches the legacy `agent_tokens` table. If Claude Code regresses, the issue is unrelated to OAuth; verify the token starts with `cd_` and not `cd_oat_`.
