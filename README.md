# Chaos Dimension

> A note from the author: I wanted a JIRA, but for me. Specifically, a JIRA with a control panel for dispatching coding agents and watching them work. I looked and did not find one. So I built it, and I started by making it look like a 1991 Macintosh — then I added a few more skins so it could match my mood: a green-on-black terminal for late nights, a quiet Minimal for focus, and a flat Modern for when I'm screen-sharing with someone who didn't grow up with a beige tower.

A themeable mission control for personal projects and AI agent orchestration. Kanban on the left, agent monitor on the right. Four skins: Classic Mac OS (the default), Minimal, Terminal, and Modern.

| Classic Mac OS | Minimal |
| --- | --- |
| ![Classic Mac OS theme](screenshots/theme-classic.png) | ![Minimal theme](screenshots/theme-minimal.png) |
| **Terminal** | **Modern** |
| ![Terminal theme](screenshots/theme-terminal.png) | ![Modern theme](screenshots/theme-modern.png) |

Live demo: [chaosdimension.fyi](https://chaosdimension.fyi)

## Why

Modern project trackers are bloated, modern UIs are beige, and none of them have a column for "this task is currently being worked on by a Claude agent in a tmux pane somewhere." Chaos Dimension fixes all three problems.

## Design Choices

Four themes, one layout. Classic Mac OS System 7 (the default — striped title bars, beveled buttons, blue dither desktop) for when nostalgia is the feature. Minimal for when you want the chrome to disappear. Terminal for green-on-black late-night hacker mode. Modern for when you're screen-sharing with civilians.

Themes are a theme provider plus CSS-variable-style style objects, not a component library swap — every theme renders the exact same React tree. Inline styles throughout, no Tailwind, no shadcn. The whole point was to prove that a 1991 aesthetic could share a codebase with a 2026 one without either feeling like a compromise.

## The Name

"Chaos dimension" is a lyric from ["Almost Had to Start a Fight / In and Out of Patience"](https://open.spotify.com/track/7xhZCVsVhDSjhFm41mOX10?si=5bc063da68f24a56) by Parquet Courts, a Brooklyn band. Felt about right for a tool that orchestrates several agents trying to do several things at once.

> "Can someone tell me the reason? I'm in the Chaos Dimension. Trapped in a brutal invention." -Parquet Courts
## How to build and deploy your own Chaos Dimension

### Local development

```bash
git clone https://github.com/<you>/chaos_dimension
cd chaos_dimension
npm install
cp .env.example .env.local

# Generate the password hash for your own login
npm run hash-password
# Paste the printed bcrypt hash into .env.local as CHAOS_PASSWORD_HASH

# Generate a session secret
openssl rand -hex 32
# Paste it into .env.local as CHAOS_SESSION_SECRET

# Get a free Neon Postgres at https://neon.tech
# Paste the connection string into .env.local as DATABASE_URL

npm run db:push   # create the tables
npm run db:seed   # seed workstream definitions
npm run dev       # http://localhost:5173
```

For a fuller local run including the serverless `/api/*` handlers, install the Vercel CLI (`npm i -g vercel`) and use `vercel dev` instead of `npm run dev`.

### Deploy to Vercel

1. Push your fork to GitHub.
2. Import the repo in Vercel.
3. From the project dashboard, add Neon Postgres via the marketplace (free tier). `DATABASE_URL` is injected automatically.
4. Set `CHAOS_PASSWORD_HASH` and `CHAOS_SESSION_SECRET` in Vercel env vars.
5. Leave `CHAOS_PUBLIC_DEMO` and `VITE_PUBLIC_DEMO` unset for a private deploy — visitors get the login screen first. Set both to `true` if you want a public demo landing instead.
6. Pull the env locally and migrate: `vercel env pull && npm run db:push && npm run db:seed`.
7. Deploy.

### Connect Claude Code via MCP

Lets Claude Code (or any MCP client) read and write your tasks, claim work, and report progress from inside any coding session.

1. **Mint an API token** from a clone of this repo:
   ```bash
   npm run mint-api-key -- --label macbook
   ```
   The script prints a `cd_...` token. Copy it. (Token is shown once.)

2. **Register the MCP server with Claude Code**:
   ```bash
   claude mcp add --scope user --transport http chaos-dimension \
     https://www.your-deploy.fyi/api/mcp \
     --header "Authorization: Bearer cd_paste-your-token-here"
   ```
   The `--scope user` flag makes the server available from any project directory. Drop it for project-scoped.

3. **Restart Claude Code**, then inside it run:
   ```
   /mcp
   ```
   You should see `chaos-dimension` connected with 7 tools (`list_workstreams`, `list_tasks`, `get_task`, `create_task`, `update_task`, `claim_task`, `report_progress`).

4. **(Optional) Enable auto-tracking.** Paste the snippet from `docs/integration/CLAUDE.md.snippet` into a project's `CLAUDE.md` or your global `~/.claude/CLAUDE.md`. Claude will ask before creating tasks for non-trivial work and report progress as it goes.

### Connect Claude Desktop or claude.ai (web) via OAuth

The MCP server speaks OAuth 2.1 with Dynamic Client Registration, so the connector dialog can self-register without any token wrangling.

1. In **Claude Desktop** or **claude.ai** → Settings → Connectors → **Add custom connector**.
2. **URL:** `https://www.your-deploy.fyi/api/mcp` (replace with your deploy host).
3. Leave OAuth Client ID and Client Secret blank — the connector registers itself automatically.
4. Click **Add**. Claude opens a browser tab on your dashboard for password login + a consent screen. Click **Allow** and the dance completes; the chaos-dimension tools appear in any new chat.

Full MCP setup details and troubleshooting: see [`docs/integration/README.md`](docs/integration/README.md).

> **Note:** if your deploy's apex domain redirects to `www`, use the `www.` URL in step 2. MCP clients don't follow POST redirects and you'll see `JSON Parse error: Unrecognized token '<'`.

## Features

- Kanban board: Backlog → Active → Review → Done
- Agent Monitor with green-on-black terminal logs per agent
- Workstream color-coding with striped progress bars
- ⚡ markers on agent-dispatchable tasks
- Password-gated private mode + optional public demo landing (interactive, localStorage-backed)
- MCP server: connect Claude Code; tasks update from inside your coding sessions
- Four themes (Classic Mac OS, Minimal, Terminal, Modern)
- Live dashboard updates (polls every 10s when the tab is visible)

## Stack

React 18 + Vite frontend. Vercel serverless functions for `/api/*`. Neon Postgres + Drizzle ORM for persistence. `iron-session` + bcryptjs for the single-user password gate. `@modelcontextprotocol/sdk` for the MCP server.

## Roadmap

- [x] Database (Postgres via Neon)
- [x] Sign-on screen, Mac OS login dialog style
- [x] Multi-theme system (Classic / Minimal / Terminal / Modern)
- [x] Interactive demo board with localStorage persistence
- [x] MCP server (v0.4) — Claude Code claims and updates tasks via standard MCP tools
- [x] OAuth 2.1 + dynamic client registration on `/api/mcp` so Claude Desktop and claude.ai web can connect
- [ ] AIM Messenger-style chat panel that routes to the Anthropic API
- [ ] Settings → API Keys management UI (currently CLI-only)
- [ ] Cloud orchestrator: ephemeral containers that run agent tasks while your laptop is closed
- [ ] Worklog export for blog posts

## Contributing

Contributions are welcome. This is a small project with one maintainer, so please open an issue before starting non-trivial work so we can align on scope.

**Filing issues.** Bugs: include steps to reproduce, what you expected, what happened, and your browser + OS. Feature requests: describe the use case, not just the feature.

**Pull requests.**

1. Fork the repo and create a topic branch off `main`.
2. Run `npm install` and follow the [Local development](#local-development) setup.
3. Make your change. Keep commits focused and write a clear commit message that explains the why.
4. Add or update tests where it makes sense. Run `npm test` before pushing.
5. Open a PR against `main`. Link the related issue if there is one. Small, focused PRs get reviewed faster than sprawling ones.

**Code style.** Match what's already there. No new dependencies without discussion. No em-dashes in UI copy (docs are fine). If you're touching the UI, run it in a browser and confirm the change looks right.

**Code of conduct.** Be kind. Disagree on the technical merits, not the person.

## License

MIT
