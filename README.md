# Chaos Dimension

> A note from the author: I wanted a JIRA, but for me. Specifically, a JIRA with a control panel for dispatching coding agents and watching them work. I looked and did not find one. So I built it, and I made it look like a 1991 Macintosh, because if I'm going to stare at a project tracker all day it should at least be fun.

A retro Mac OS System 7-styled mission control for personal projects and AI agent orchestration. Kanban on the left, agent terminal monitor on the right, blue dither desktop everywhere.

## Why

Modern project trackers are bloated, modern UIs are beige, and none of them have a column for "this task is currently being worked on by a Claude agent in a tmux pane somewhere." Chaos Dimension fixes all three problems.

## Design Choices

System 7 chrome (striped title bars, beveled buttons, inset borders) because constraint breeds taste, and because rounded corners have had their fun. Inline styles, no component library, no Tailwind — the whole point is that it looks deliberately old.

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

## Features

- Kanban board: Backlog → Active → Review → Done
- Agent Monitor with green-on-black terminal logs per agent
- Workstream color-coding with striped progress bars
- ⚡ markers on agent-dispatchable tasks (some work is still for humans)
- Password-gated private mode + optional public demo landing

## Stack

React 18 + Vite frontend. Vercel serverless functions for `/api/*`. Neon Postgres + Drizzle ORM for persistence. `iron-session` + bcryptjs for the single-user password gate.

## Roadmap

- [x] Database (Postgres via Neon)
- [x] Sign-on screen, Mac OS login dialog style
- [ ] Agent connection v1: file-based, via Claude Code post-task hooks
- [ ] Agent connection v2: Anthropic API dispatch with streamed terminal output
- [ ] Agent connection v3: MCP server so any agent can report back
- [ ] Worklog export for blog posts

## Contributing

If you also want a JIRA that looks like a 1991 Macintosh: PRs welcome. Keep the aesthetic. No rounded corners. No em-dashes in UI copy.

## License

MIT
