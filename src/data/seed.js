export const SEED_TASKS = [
  { id: "t1", title: "Citator infrastructure (KeyCite equiv)", workstream: "legal-ai", column: "backlog", agentDispatchable: true, priority: "high", notes: "Most critical infrastructure gap." },
  { id: "t2", title: "CourtListener rate limit optimization", workstream: "legal-ai", column: "backlog", agentDispatchable: true, priority: "med", notes: "" },
  { id: "t3", title: "Firm pivot — case intake workflow", workstream: "legal-ai", column: "backlog", agentDispatchable: false, priority: "high", notes: "Design case intake, assignment, and billing flow." },
  { id: "t4", title: "Lit review — emergence in multi-agent systems", workstream: "emergent-creativity", column: "backlog", agentDispatchable: true, priority: "high", notes: "" },
  { id: "t5", title: "Define experimental framework for putu.ai", workstream: "emergent-creativity", column: "backlog", agentDispatchable: false, priority: "med", notes: "What constitutes 'emergent creativity'?" },
  { id: "t6", title: "putu.ai — inter-agent coordination", workstream: "emergent-creativity", column: "backlog", agentDispatchable: true, priority: "high", notes: "Collab/beef/recruit mechanics." },
  { id: "t7", title: "TIGER replication experiment", workstream: "generative-retrieval", column: "backlog", agentDispatchable: true, priority: "high", notes: "" },
  { id: "t8", title: "Novel contribution — define research gap", workstream: "generative-retrieval", column: "backlog", agentDispatchable: false, priority: "high", notes: "" },
  { id: "t9", title: "Draft paper outline + related work", workstream: "generative-retrieval", column: "backlog", agentDispatchable: true, priority: "med", notes: "Build on existing slide decks." },
  { id: "t10", title: "Generative art project #1 — scope", workstream: "generative-art", column: "backlog", agentDispatchable: false, priority: "med", notes: "" },
  { id: "t11", title: "First blog post — summer goals & Chaos Dimension", workstream: "blog", column: "active", agentDispatchable: false, priority: "med", notes: "Document the meta-process." },
  { id: "t12", title: "Blog infrastructure — deploy", workstream: "blog", column: "backlog", agentDispatchable: true, priority: "high", notes: "" },
  { id: "t13", title: "IC skills audit — gap analysis", workstream: "career", column: "backlog", agentDispatchable: false, priority: "med", notes: "" },
];

export const SEED_AGENTS = [
  { id: "a1", taskId: null, name: "claude-alpha", status: "idle", startedAt: null, log: [] },
  { id: "a2", taskId: null, name: "claude-bravo", status: "idle", startedAt: null, log: [] },
  { id: "a3", taskId: null, name: "claude-charlie", status: "idle", startedAt: null, log: [] },
];
