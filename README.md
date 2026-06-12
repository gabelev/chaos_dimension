# Chaos Dimension

> A note from the author: I wanted a JIRA, but for me. Specifically, a JIRA with a control panel for dispatching coding agents and watching them work. I looked and did not find one. So I built it, and I started by making it look like a 1991 Macintosh — then I added a few more skins so it could match my mood: a green-on-black terminal for late nights, a quiet Minimal for focus, and a clean Notional skin for when I want it to look like the tool everyone already knows.

A themeable mission control for personal projects and AI agent orchestration. Kanban on the left, agent monitor on the right. Four skins: Classic Mac OS (the default), Notional, Minimal, and Terminal.

| Classic Mac OS | Minimal | Terminal |
| --- | --- | --- |
| ![Classic Mac OS theme](screenshots/theme-classic.png) | ![Minimal theme](screenshots/theme-minimal.png) | ![Terminal theme](screenshots/theme-terminal.png) |

Live demo: [chaosdimension.fyi](https://chaosdimension.fyi)

## Why

Modern project trackers are bloated, modern UIs are beige, and none of them have a column for "this task is currently being worked on by a Claude agent in a tmux pane somewhere." Chaos Dimension fixes all three problems.

## Design Choices

Four themes, one layout. Classic Mac OS System 7 (the default — striped title bars, beveled buttons, blue dither desktop) for when nostalgia is the feature. Notional for a clean, Notion-style warm-gray look that disappears into a workday. Minimal for when you want the chrome to disappear. Terminal for green-on-black late-night hacker mode.

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

> If you're signed into a hosted instance, the **Connect AI** menu in the dashboard walks you through this (and the Claude Desktop / ChatGPT cases below) with a live verify panel. The steps here are the canonical reference, used by self-hosters and anyone who'd rather copy-paste than click.

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
   You should see `chaos-dimension` connected. Tools cover workstreams (`list_workstreams`, `create_workstream`, `update_workstream`, `delete_workstream`), tasks (`list_tasks`, `get_task`, `create_task`, `update_task`, `claim_task`, `report_progress`), and spec / requirements docs (`create_spec`, `list_specs`, `get_spec`, `get_spec_revision`, `update_spec`, `delete_spec`).

4. **(Optional) Enable auto-tracking.** Paste the snippet from `docs/integration/CLAUDE.md.snippet` into a project's `CLAUDE.md` or your global `~/.claude/CLAUDE.md`. Claude will ask before creating tasks for non-trivial work and report progress as it goes.

### Connect Claude Desktop or claude.ai (web) via OAuth

> Same note as above — signed-in users can use the dashboard's **Connect AI** menu for a guided walk-through with verify-when-it-connects polling.

The MCP server speaks OAuth 2.1 with Dynamic Client Registration, so the connector dialog can self-register without any token wrangling.

1. In **Claude Desktop** or **claude.ai** → Settings → Connectors → **Add custom connector**.
2. **URL:** `https://www.your-deploy.fyi/api/mcp` (replace with your deploy host).
3. Leave OAuth Client ID and Client Secret blank — the connector registers itself automatically.
4. Click **Add**. Claude opens a browser tab on your dashboard for password login + a consent screen. Click **Allow** and the dance completes; the chaos-dimension tools appear in any new chat.

Full MCP setup details and troubleshooting: see [`docs/integration/README.md`](docs/integration/README.md).

> **Note:** if your deploy's apex domain redirects to `www`, use the `www.` URL in step 2. MCP clients don't follow POST redirects and you'll see `JSON Parse error: Unrecognized token '<'`.

### Coordinate agents on a droplet or remote server with `claude-rc-server`

Chaos Dimension is the board; [`claude-rc-server`](https://github.com/gabelev/claude-rc-server) is the runtime that keeps agents working on it. It runs persistent, multi-repo Claude Code Remote Control on a headless box — a DigitalOcean droplet, any Ubuntu/Debian VPS, or a spare machine on your LAN — so you can start and drive long-lived agent sessions from [claude.ai/code](https://claude.ai/code) or the mobile app instead of a terminal that has to stay open on your laptop.

The two repos mesh through MCP. `claude-rc-server` runs one server per repo as a systemd user service (surviving reboots) and registers this project's MCP endpoint at **user scope** via its `setup-mcp.sh` script — the same registration described in [Connect Claude Code via MCP](#connect-claude-code-via-mcp), done once for every repo on the box. From then on:

- Agents running on the server **read** their work from Chaos Dimension (`list_tasks`, `claim_task`) and **report progress back** (`report_progress`, `update_task`), so the Kanban board and Agent Monitor reflect what's happening on the droplet in near real time.
- Because the token lives in the server's env file, every session across every repo inherits the same Chaos Dimension connection. Configure once, available everywhere.
- You stay in the loop from your phone: dispatch a task on the board, an agent on the server claims it, and the logs stream into the Agent Monitor while your laptop is closed.

In short: Chaos Dimension coordinates *what* gets worked on and surfaces the state; `claude-rc-server` is *where* the agents actually run. See its [README](https://github.com/gabelev/claude-rc-server#readme) for the full setup — `install.sh`, `auth.sh`, `setup-mcp.sh`, then `add-repo.sh` once per repo.

## Spec / requirements docs

Tasks and workstreams can carry a **spec** — a versioned markdown requirements doc — so the context for a piece of work lives next to the work instead of in a chat scrollback. A spec attaches to exactly one of a workstream (shared context for every task in it) or a single task.

The intended loop is voice-to-code: dictate a spec to Claude ("write a spec for the import feature and attach it to the Build workstream"), then have a coding agent pull it back inside Claude Code when it picks up a task. Every content edit appends an immutable revision, so a spec can evolve without losing earlier versions.

- **In the app** — open a task or workstream and use the Specs section to add or edit a doc. Content is markdown; the revision history is listed, and older revisions can be viewed.
- **Over MCP** — `create_spec`, `list_specs`, `get_spec`, `get_spec_revision`, `update_spec`, `delete_spec`. `get_task` also returns a `specs` array of the task's own plus its workstream's specs, so an agent that claims a task sees them immediately and can `get_spec` the full content before starting work.

Specs are per-user (RLS-scoped) just like tasks and workstreams.

## Features

- Kanban board: Backlog → Active → Review → Done
- Agent Monitor with green-on-black terminal logs per agent
- Workstream color-coding with striped progress bars
- ⚡ markers on agent-dispatchable tasks
- Password-gated private mode + optional public demo landing (interactive, localStorage-backed)
- Owner admin page (`/admin`): mint/revoke invites, reset a user's password, and invite from the waitlist — all from the browser (the CLI scripts still work)
- MCP server: connect Claude Code; tasks update from inside your coding sessions
- Spec / requirements docs: attach a versioned markdown doc to a workstream or a task (dictate one to Claude, pull it back via MCP when an agent picks up the work)
- Four themes (Classic Mac OS, Notional, Minimal, Terminal)
- Live dashboard updates (polls every 10s when the tab is visible)

## Stack

React 18 + Vite frontend. Vercel serverless functions for `/api/*`. Neon Postgres + Drizzle ORM for persistence. `iron-session` + bcryptjs for the single-user password gate. `@modelcontextprotocol/sdk` for the MCP server.

## Roadmap

- [x] Database (Postgres via Neon)
- [x] Sign-on screen, Mac OS login dialog style
- [x] Multi-theme system (Classic / Notional / Minimal / Terminal)
- [x] Interactive demo board with localStorage persistence
- [x] MCP server (v0.4) — Claude Code claims and updates tasks via standard MCP tools
- [x] OAuth 2.1 + dynamic client registration on `/api/mcp` so Claude Desktop and claude.ai web can connect
- [x] Spec / requirements docs — versioned markdown specs on tasks/workstreams, authored in-app or via MCP
- [ ] AIM Messenger-style chat panel that routes to the Anthropic API
- [ ] Settings → API Keys management UI (currently CLI-only)
- [ ] Cloud orchestrator: ephemeral containers that run agent tasks while your laptop is closed
- [~] Remote agent runtime: drive long-lived agents on a droplet/VPS/local box via [`claude-rc-server`](https://github.com/gabelev/claude-rc-server), reporting to the board over MCP (persistent servers today; ephemeral containers still TODO)
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

[AGPL-3.0-only](LICENSE). If you run a modified version of this software as a network service, you must make the source of your modified version available to users of that service (AGPL §13). The canonical source is at [github.com/gabelev/chaos_dimension](https://github.com/gabelev/chaos_dimension); the hosted instance at [chaosdimension.fyi](https://chaosdimension.fyi) runs this repo unmodified.
