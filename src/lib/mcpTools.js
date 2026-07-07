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
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../db/client.js';
import { tasks, agents, workstreams, specs, specRevisions } from '../db/schema.js';
import { withUserContext } from './userContext.js';

// Resolve a workstream identifier (cuid id OR human slug) to the canonical id.
// Returns null if no match for this user.
async function resolveWorkstreamId(tx, value) {
  if (!value) return null;
  const rows = await tx.select().from(workstreams)
    .where(or(eq(workstreams.id, value), eq(workstreams.slug, value)));
  return rows[0]?.id ?? null;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function nextAvailableSlug(tx, base) {
  const taken = async (slug) => (await tx.select().from(workstreams).where(eq(workstreams.slug, slug))).length > 0;
  if (!(await taken(base))) return base;
  for (let n = 2; n <= 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return null;
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
    name: 'create_workstream',
    description: 'Create a new workstream. Required: label. Optional: color (hex like "#4B0082"), icon (single emoji or character). Slug is auto-derived from the label.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        color: { type: 'string' },
        icon: { type: 'string' },
      },
      required: ['label'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      const label = input.label?.trim();
      if (!label) throw new Error('label required');
      const baseSlug = slugify(label);
      if (!baseSlug) throw new Error('label must contain letters or numbers (slug could not be derived)');
      const color = input.color?.trim() || '#666666';
      const icon = input.icon?.trim() || '•';
      return withUserContext(db, userId, async (tx) => {
        const slug = await nextAvailableSlug(tx, baseSlug);
        if (!slug) throw new Error('too many workstreams with this name (slug collision)');
        const [row] = await tx.insert(workstreams).values({
          id: createId(),
          label,
          color,
          icon,
          slug,
          userId,
        }).returning();
        return row;
      });
    },
  },
  {
    name: 'update_workstream',
    description: 'Update a workstream by id or slug. Provide any of label, color, icon, isPublic. Setting isPublic true exposes the workstream (and its tasks/specs) on the unauthenticated read-only public ledger at /api/public/:slug; false removes it. Slug is not editable to avoid breaking references.',
    inputSchema: {
      type: 'object',
      properties: {
        idOrSlug: { type: 'string' },
        label: { type: 'string' },
        color: { type: 'string' },
        icon: { type: 'string' },
        isPublic: { type: 'boolean' },
      },
      required: ['idOrSlug'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.idOrSlug?.trim()) throw new Error('idOrSlug required');
      const ALLOWED = ['label', 'color', 'icon'];
      const updates = {};
      for (const k of ALLOWED) {
        if (k in input && typeof input[k] === 'string') updates[k] = input[k];
      }
      if ('isPublic' in input && typeof input.isPublic === 'boolean') updates.isPublic = input.isPublic;
      if (Object.keys(updates).length === 0) throw new Error('no fields to update');
      return withUserContext(db, userId, async (tx) => {
        const wsId = await resolveWorkstreamId(tx, input.idOrSlug);
        if (!wsId) throw new Error(`unknown workstream: ${input.idOrSlug}`);
        const [row] = await tx.update(workstreams).set(updates).where(eq(workstreams.id, wsId)).returning();
        return row;
      });
    },
  },
  {
    name: 'delete_workstream',
    description: 'Delete a workstream by id or slug. Refuses if any tasks still reference it — move or delete those tasks first.',
    inputSchema: {
      type: 'object',
      properties: { idOrSlug: { type: 'string' } },
      required: ['idOrSlug'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.idOrSlug?.trim()) throw new Error('idOrSlug required');
      return withUserContext(db, userId, async (tx) => {
        const wsId = await resolveWorkstreamId(tx, input.idOrSlug);
        if (!wsId) throw new Error(`unknown workstream: ${input.idOrSlug}`);
        const referencing = await tx.select().from(tasks).where(eq(tasks.workstream, wsId));
        if (referencing.length > 0) {
          throw new Error(
            `cannot delete workstream: ${referencing.length} task${referencing.length === 1 ? '' : 's'} still reference it. Move or delete them first.`
          );
        }
        const [deleted] = await tx.delete(workstreams).where(eq(workstreams.id, wsId)).returning();
        return { ok: true, deleted };
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
    description: 'Fetch one task by id (full detail including notes). Also returns a `specs` array of any spec/requirements docs attached to the task or inherited from its workstream — call get_spec on one to read its full content before starting work.',
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
        const task = rows[0];
        const specRows = await tx
          .select({
            id: specs.id,
            title: specs.title,
            workstreamId: specs.workstreamId,
            taskId: specs.taskId,
            version: specs.version,
            updatedAt: specs.updatedAt,
            createdVia: specs.createdVia,
          })
          .from(specs)
          .where(or(eq(specs.taskId, task.id), eq(specs.workstreamId, task.workstream)));
        const attached = specRows.map((s) => ({ ...s, scope: s.taskId ? 'task' : 'workstream' }));
        return { ...task, specs: attached };
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
            createdVia: 'mcp',
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
  {
    name: 'create_spec',
    description: 'Create a spec / requirements doc attached to EXACTLY ONE of a task or a workstream. Required: title, content (markdown), and exactly one of task (task id) or workstream (id or slug). A workstream spec is shared context for every task in that stream; a task spec is scoped to one task. Use this to capture a feature spec dictated to Claude so a coding agent can pull it later via get_task/get_spec.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        task: { type: 'string', description: 'Task id to attach to (omit if attaching to a workstream)' },
        workstream: { type: 'string', description: 'Workstream id or slug to attach to (omit if attaching to a task)' },
        note: { type: 'string', description: 'Optional summary of this initial revision' },
      },
      required: ['title', 'content'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      const title = input.title?.trim();
      if (!title) throw new Error('title required');
      if (typeof input.content !== 'string') throw new Error('content required');
      const hasTask = !!input.task?.trim();
      const hasWs = !!input.workstream?.trim();
      if (hasTask === hasWs) throw new Error('provide exactly one of task or workstream');
      return withUserContext(db, userId, async (tx) => {
        let taskId = null;
        let workstreamId = null;
        if (hasTask) {
          const rows = await tx.select().from(tasks).where(eq(tasks.id, input.task.trim())).limit(1);
          if (!rows.length) throw new Error(`unknown task: ${input.task}`);
          taskId = rows[0].id;
        } else {
          const wsId = await resolveWorkstreamId(tx, input.workstream);
          if (!wsId) throw new Error(`unknown workstream: ${input.workstream}`);
          workstreamId = wsId;
        }
        const [spec] = await tx
          .insert(specs)
          .values({
            title,
            content: input.content,
            version: 1,
            taskId,
            workstreamId,
            createdVia: 'mcp',
            userId,
          })
          .returning();
        await tx.insert(specRevisions).values({
          specId: spec.id,
          version: 1,
          title,
          content: input.content,
          note: input.note ?? '',
          createdVia: 'mcp',
          userId,
        });
        return spec;
      });
    },
  },
  {
    name: 'list_specs',
    description: 'List spec / requirements docs (metadata only — use get_spec for full content). Optional filters: task (task id), workstream (id or slug), limit (default 20, max 200).',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        workstream: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 200 },
      },
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      return withUserContext(db, userId, async (tx) => {
        const conds = [];
        if (input.task) conds.push(eq(specs.taskId, input.task));
        if (input.workstream) {
          const wsId = await resolveWorkstreamId(tx, input.workstream);
          if (!wsId) return [];
          conds.push(eq(specs.workstreamId, wsId));
        }
        const limit = Math.min(input.limit ?? 20, 200);
        let q = tx
          .select({
            id: specs.id,
            title: specs.title,
            workstreamId: specs.workstreamId,
            taskId: specs.taskId,
            version: specs.version,
            updatedAt: specs.updatedAt,
            createdVia: specs.createdVia,
          })
          .from(specs);
        if (conds.length) q = q.where(and(...conds));
        return q.orderBy(desc(specs.updatedAt)).limit(limit);
      });
    },
  },
  {
    name: 'get_spec',
    description: 'Fetch one spec by id with its full current content. Set includeRevisions to also get the revision history (metadata only — use get_spec_revision for an old body).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        includeRevisions: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      return withUserContext(db, userId, async (tx) => {
        const rows = await tx.select().from(specs).where(eq(specs.id, input.id)).limit(1);
        if (!rows.length) throw new Error('spec not found');
        const spec = rows[0];
        if (input.includeRevisions) {
          const revs = await tx
            .select({
              version: specRevisions.version,
              title: specRevisions.title,
              note: specRevisions.note,
              createdVia: specRevisions.createdVia,
              createdAt: specRevisions.createdAt,
            })
            .from(specRevisions)
            .where(eq(specRevisions.specId, spec.id))
            .orderBy(desc(specRevisions.version));
          return { ...spec, revisions: revs };
        }
        return spec;
      });
    },
  },
  {
    name: 'get_spec_revision',
    description: 'Fetch the full content of one historical revision of a spec. Required: id (spec id), version.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        version: { type: 'number' },
      },
      required: ['id', 'version'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      return withUserContext(db, userId, async (tx) => {
        const rows = await tx
          .select()
          .from(specRevisions)
          .where(and(eq(specRevisions.specId, input.id), eq(specRevisions.version, input.version)))
          .limit(1);
        if (!rows.length) throw new Error('spec revision not found');
        return rows[0];
      });
    },
  },
  {
    name: 'update_spec',
    description: 'Update a spec by id. Provide any of title, content, note. A content change appends a new revision and bumps the version; a title-only change does not.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        note: { type: 'string', description: 'Optional summary of the change, recorded on the new revision' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.id) throw new Error('id required');
      const hasTitle = typeof input.title === 'string';
      const hasContent = typeof input.content === 'string';
      if (!hasTitle && !hasContent) throw new Error('provide title and/or content to update');
      return withUserContext(db, userId, async (tx) => {
        const rows = await tx.select().from(specs).where(eq(specs.id, input.id)).limit(1);
        if (!rows.length) throw new Error('spec not found');
        const current = rows[0];
        const newTitle = hasTitle ? input.title.trim() : current.title;
        const contentChanged = hasContent && input.content !== current.content;
        const updates = { title: newTitle, updatedAt: new Date() };
        if (contentChanged) {
          updates.content = input.content;
          updates.version = current.version + 1;
        }
        const [updated] = await tx.update(specs).set(updates).where(eq(specs.id, input.id)).returning();
        if (contentChanged) {
          await tx.insert(specRevisions).values({
            specId: current.id,
            version: updated.version,
            title: newTitle,
            content: input.content,
            note: input.note ?? '',
            createdVia: 'mcp',
            userId,
          });
        }
        return updated;
      });
    },
  },
  {
    name: 'delete_spec',
    description: 'Delete a spec by id (its revision history is removed too).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async ({ db, userId, input }) => {
      if (!input.id) throw new Error('id required');
      return withUserContext(db, userId, async (tx) => {
        await tx.delete(specRevisions).where(eq(specRevisions.specId, input.id));
        const [deleted] = await tx.delete(specs).where(eq(specs.id, input.id)).returning();
        if (!deleted) throw new Error('spec not found');
        return { ok: true, deleted };
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
