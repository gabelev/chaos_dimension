# Chaos Dimension MCP — Setup

Connect Claude Code (or any MCP client) to your Chaos Dimension deployment.

## One-time per machine

1. **Mint a token.** From a clone of this repo:
   ```bash
   npm run mint-api-key -- --label macbook
   ```
   Enter your owner password when prompted. The script prints a JSON block — copy it. **The raw token is shown once. Don't lose it.**

2. **Open `~/.claude/.mcp.json`** (create the file if it doesn't exist). Merge the printed block into the `mcpServers` section. The full file should look something like:
   ```json
   {
     "mcpServers": {
       "chaos-dimension": {
         "url": "https://chaosdimension.fyi/api/mcp",
         "headers": {
           "Authorization": "Bearer cd_paste-your-token-here"
         }
       }
     }
   }
   ```

3. **Restart Claude Code.** The seven `chaos-dimension` tools will appear in the available tool list (`list_workstreams`, `list_tasks`, `get_task`, `create_task`, `update_task`, `claim_task`, `report_progress`).

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
