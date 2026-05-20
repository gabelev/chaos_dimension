import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { tasks, agents, workstreams } from '../db/schema.js';

const TOOL_DEFS = [
  {
    name: 'list_workstreams',
    description: 'List all workstreams (id, label, color, icon).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async ({ db }) => {
      return db.select().from(workstreams);
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks. Optional filters: workstream, column, priority, limit (default 20, max 200).',
    inputSchema: {
      type: 'object',
      properties: {
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'] },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        limit: { type: 'number', minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      const conds = [];
      if (input.workstream) conds.push(eq(tasks.workstream, input.workstream));
      if (input.column) conds.push(eq(tasks.column, input.column));
      if (input.priority) conds.push(eq(tasks.priority, input.priority));
      const limit = Math.min(input.limit ?? 20, 200);
      let q = db.select().from(tasks);
      if (conds.length) q = q.where(and(...conds));
      return q.orderBy(desc(tasks.createdAt)).limit(limit);
    },
  },
  {
    name: 'get_task',
    description: 'Fetch one task by id (full detail including notes).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, input }) => {
      const rows = await db.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!rows.length) throw new Error('task not found');
      return rows[0];
    },
  },
];

export const TOOLS = TOOL_DEFS;
export const TOOLS_BY_NAME = Object.fromEntries(TOOL_DEFS.map(t => [t.name, t]));

export async function runTool(name, input, ctx = {}) {
  const tool = TOOLS_BY_NAME[name];
  if (!tool) throw new Error(`unknown tool: ${name}`);
  const db = ctx.db ?? getDb();
  return tool.handler({ db, input: input ?? {}, agentId: ctx.agentId });
}
