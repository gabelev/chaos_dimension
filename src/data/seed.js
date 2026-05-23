// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
export const SEED_TASKS = [
  // Research
  { id: "t1", title: "Annotate this week's field-recording set", workstream: "research", column: "active", agentDispatchable: true, priority: "high", notes: "Trying to find that one bird call from the marsh recording." },
  { id: "t2", title: "Read the new paper on bioacoustic foundation models", workstream: "research", column: "backlog", agentDispatchable: false, priority: "med", notes: "Section 4 looks most relevant." },
  { id: "t3", title: "Re-read 'The Alignment Problem' chapters 6-8", workstream: "research", column: "backlog", agentDispatchable: false, priority: "low", notes: "For the essay." },
  { id: "t4", title: "Survey the arxiv-sanity feed for the week", workstream: "research", column: "backlog", agentDispatchable: true, priority: "low", notes: "" },

  // Studio
  { id: "t5", title: "Mix down 'November Loops' track 3", workstream: "studio", column: "active", agentDispatchable: false, priority: "high", notes: "Pads are sitting too far back." },
  { id: "t6", title: "Cover art for the EP — three concept sketches", workstream: "studio", column: "backlog", agentDispatchable: false, priority: "med", notes: "Risograph or letterpress feel." },
  { id: "t7", title: "Long-exposure series at the harbor this weekend", workstream: "studio", column: "backlog", agentDispatchable: false, priority: "low", notes: "Bring ND filter + tripod." },

  // Writing
  { id: "t8", title: "First draft — essay on attention and slow looking", workstream: "writing", column: "active", agentDispatchable: false, priority: "high", notes: "Pull the John Berger quote from the notebook." },
  { id: "t9", title: "Newsletter — open paragraph rewrite", workstream: "writing", column: "review", agentDispatchable: false, priority: "med", notes: "Too earnest. Drier." },
  { id: "t10", title: "Reply to D.'s long email about the show", workstream: "writing", column: "backlog", agentDispatchable: false, priority: "low", notes: "" },

  // Build
  { id: "t11", title: "CLI: parse Strava CSV → SVG heatmap of routes", workstream: "build", column: "backlog", agentDispatchable: true, priority: "med", notes: "Weekend project. Should be ~200 LOC." },
  { id: "t12", title: "Fix the static-site search index bug", workstream: "build", column: "backlog", agentDispatchable: true, priority: "high", notes: "Lunr returns stale results after rebuild." },
  { id: "t13", title: "Try Bun for the photo-renamer side project", workstream: "build", column: "done", agentDispatchable: true, priority: "low", notes: "Surprised how nice the DX is." },

  // Practice
  { id: "t14", title: "Spanish — 30min Anki, every day this week", workstream: "practice", column: "active", agentDispatchable: false, priority: "med", notes: "Subjunctive review cards are killing me." },
  { id: "t15", title: "Piano — work through Hanon chapter 4", workstream: "practice", column: "backlog", agentDispatchable: false, priority: "low", notes: "" },
  { id: "t16", title: "Sketch hands every day for two weeks", workstream: "practice", column: "backlog", agentDispatchable: false, priority: "low", notes: "Loomis method." },

  // Body
  { id: "t17", title: "Marathon base — build to 30mpw by end of month", workstream: "body", column: "active", agentDispatchable: false, priority: "high", notes: "Easy pace. Don't get cute." },
  { id: "t18", title: "Strength block — week 3, deload incoming", workstream: "body", column: "backlog", agentDispatchable: false, priority: "med", notes: "" },
  { id: "t19", title: "Sleep average back above 7h", workstream: "body", column: "done", agentDispatchable: false, priority: "high", notes: "Phone out of the bedroom worked." },
];

export const SEED_AGENTS = [
  { id: "a1", taskId: null, name: "claude-alpha", status: "idle", startedAt: null, log: [] },
  { id: "a2", taskId: null, name: "claude-bravo", status: "idle", startedAt: null, log: [] },
  { id: "a3", taskId: null, name: "claude-charlie", status: "idle", startedAt: null, log: [] },
];
