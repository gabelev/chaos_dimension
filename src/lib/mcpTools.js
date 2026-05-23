// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq, and, or, desc } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { tasks, agents, workstreams } from '../db/schema.js';
import { withUserContext } from './userContext.js';

// Resolve a workstream identifier (cuid id OR human slug) to the canonical id.
// Returns null if no match for this user.
async function resolveWorkstreamId(tx, value) {
  if (!value) return null;
  const rows = await tx.select().from(workstreams)
    .where(or(eq(workstreams.id, value), eq(workstreams.slug, value)));
  return rows[0]?.id ?? null;
}

const TOOL_DEFS = [
  {
    name: 'list_workstreams',
    description: 'List all workstreams (id, label, color, icon).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async ({ db, userId }) => {
      return withUserContext(db, userId, async (tx) => {
        return tx.select().from(workstreams);
      });
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
    handler: async ({ db, userId, input }) => {
      return withUserContext(db, userId, async (tx) => {
        const conds = [];
        if (input.workstream) {
          const wsId = await resolveWorkstreamId(tx, input.workstream);
          // Filter given but unknown — return an empty list rather than all tasks.
          if (!wsId) return [];
          conds.push(eq(tasks.workstream, wsId));
        }
        if (input.column) conds.push(eq(tasks.column, input.column));
        if (input.priority) conds.push(eq(tasks.priority, input.priority));
        const limit = Math.min(input.limit ?? 20, 200);
        let q = tx.select().from(tasks);
        if (conds.length) q = q.where(and(...conds));
        return q.orderBy(desc(tasks.createdAt)).limit(limit);
      });
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
    handler: async ({ db, userId, input }) => {
      return withUserContext(db, userId, async (tx) => {
        const rows = await tx.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
        if (!rows.length) throw new Error('task not found');
        return rows[0];
      });
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. Required: title, workstream. Optional: column, priority, notes, agentDispatchable, remoteRunnable.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'], default: 'backlog' },
        priority: { type: 'string', enum: ['high', 'med', 'low'], default: 'med' },
        notes: { type: 'string', default: '' },
        agentDispatchable: { type: 'boolean', default: false },
        remoteRunnable: { type: 'boolean', default: false },
      },
      required: ['title', 'workstream'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.title?.trim()) throw new Error('title required');
      if (!input.workstream?.trim()) throw new Error('workstream required');
      return withUserContext(db, userId, async (tx) => {
        const wsId = await resolveWorkstreamId(tx, input.workstream);
        if (!wsId) throw new Error(`unknown workstream: ${input.workstream}`);
        const [row] = await tx
          .insert(tasks)
          .values({
            title: input.title.trim(),
            workstream: wsId,
            column: input.column ?? 'backlog',
            priority: input.priority ?? 'med',
            notes: input.notes ?? '',
            agentDispatchable: input.agentDispatchable ?? false,
            remoteRunnable: input.remoteRunnable ?? false,
            userId,
          })
          .returning();
        return row;
      });
    },
  },
  {
    name: 'update_task',
    description: 'Update fields on a task. Required: id. Any of title/workstream/column/priority/notes/agentDispatchable/remoteRunnable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        workstream: { type: 'string' },
        column: { type: 'string', enum: ['backlog', 'active', 'review', 'done'] },
        priority: { type: 'string', enum: ['high', 'med', 'low'] },
        notes: { type: 'string' },
        agentDispatchable: { type: 'boolean' },
        remoteRunnable: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.id) throw new Error('id required');
      const ALLOWED = ['title', 'workstream', 'column', 'priority', 'notes', 'agentDispatchable', 'remoteRunnable'];
      const updates = {};
      for (const k of ALLOWED) {
        if (k in input) updates[k] = input[k];
      }
      if (Object.keys(updates).length === 0) throw new Error('no fields to update');
      updates.updatedAt = new Date();
      return withUserContext(db, userId, async (tx) => {
        const [row] = await tx.update(tasks).set(updates).where(eq(tasks.id, input.id)).returning();
        if (!row) throw new Error('task not found');
        return row;
      });
    },
  },
  {
    name: 'claim_task',
    description: 'Move a task to the active column and assign it to the calling agent.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input, agentId }) => {
      if (!input.id) throw new Error('id required');
      if (!agentId) throw new Error('agent context required');
      return withUserContext(db, userId, async (tx) => {
        const [taskRow] = await tx
          .update(tasks)
          .set({ column: 'active', updatedAt: new Date() })
          .where(eq(tasks.id, input.id))
          .returning();
        if (!taskRow) throw new Error('task not found');
        await tx
          .update(agents)
          .set({ taskId: input.id, status: 'running', startedAt: new Date() })
          .where(eq(agents.id, agentId))
          .returning();
        return taskRow;
      });
    },
  },
  {
    name: 'report_progress',
    description: 'Append a timestamped progress message to a task\'s notes.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['id', 'message'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.id || !input.message) throw new Error('id and message required');
      return withUserContext(db, userId, async (tx) => {
        const rows = await tx.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
        if (!rows.length) throw new Error('task not found');
        const stamp = new Date().toISOString().slice(11, 16); // HH:MM
        const appended = rows[0].notes
          ? `${rows[0].notes}\n[${stamp}] ${input.message}`
          : `[${stamp}] ${input.message}`;
        const [row] = await tx
          .update(tasks)
          .set({ notes: appended, updatedAt: new Date() })
          .where(eq(tasks.id, input.id))
          .returning();
        return row;
      });
    },
  },
];

export const TOOLS = TOOL_DEFS;
export const TOOLS_BY_NAME = Object.fromEntries(TOOL_DEFS.map(t => [t.name, t]));

export async function runTool(name, input, ctx = {}) {
  const tool = TOOLS_BY_NAME[name];
  if (!tool) throw new Error(`unknown tool: ${name}`);
  const db = ctx.db ?? getDb();
  return tool.handler({ db, input: input ?? {}, agentId: ctx.agentId, userId: ctx.userId });
}
