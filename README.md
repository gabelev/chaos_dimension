# Chaos Dimension

> A note from the author: I wanted a JIRA, but for me. Specifically, a JIRA with a control panel for dispatching coding agents and watching them work. I looked and did not find one. So I built it, and I made it look like a 1991 Macintosh, because if I'm going to stare at a project tracker all day it should at least be fun.

A retro Mac OS System 7-styled mission control for personal projects and AI agent orchestration. Kanban on the left, agent terminal monitor on the right, blue dither desktop everywhere.

## Why

Modern project trackers are bloated, modern UIs are beige, and none of them have a column for "this task is currently being worked on by a Claude agent in a tmux pane somewhere." Chaos Dimension fixes all three problems.

## Design Choices

System 7 chrome (striped title bars, beveled buttons, inset borders) because constraint breeds taste, and because rounded corners have had their fun. Inline styles, no component library, no Tailwind — the whole point is that it looks deliberately old.

## The Name

"Chaos dimension" is a lyric from ["Almost Had to Start a Fight / In and Out of Patience"](https://open.spotify.com/track/7xhZCVsVhDSjhFm41mOX10?si=5bc063da68f24a56) by Parquet Courts, a Brooklyn band. Felt about right for a tool that orchestrates several agents trying to do several things at once.

## Quick Start

```bash
npm install
npm run dev
```

## Features

- Kanban board: Backlog → Active → Review → Done
- Agent Monitor with green-on-black terminal logs per agent
- Workstream color-coding with striped progress bars
- ⚡ markers on agent-dispatchable tasks (some work is still for humans)

## Stack

React 18 + Vite. No backend yet — state is in-memory. That's next.

## Roadmap

- [ ] Database (PostgreSQL or SQLite)
- [ ] Sign-on screen, Mac OS login dialog style
- [ ] Agent connection v1: file-based, via Claude Code post-task hooks
- [ ] Agent connection v2: Anthropic API dispatch with streamed terminal output
- [ ] Agent connection v3: MCP server so any agent can report back
- [ ] Worklog export for blog posts

## Contributing

If you also want a JIRA that looks like a 1991 Macintosh: PRs welcome. Keep the aesthetic. No rounded corners. No em-dashes in UI copy.

## License

MIT
