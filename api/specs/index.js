// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { getDb } from '../../src/db/client.js';
import { withUserContext } from '../../src/lib/userContext.js';
import { specs, specRevisions, tasks, workstreams } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq, and, or, desc } from 'drizzle-orm';

// Metadata projection — full content is fetched per-spec via GET /api/specs/:id.
const META = {
  id: specs.id,
  title: specs.title,
  workstreamId: specs.workstreamId,
  taskId: specs.taskId,
  version: specs.version,
  updatedAt: specs.updatedAt,
  createdVia: specs.createdVia,
};

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { task, workstream } = req.query ?? {};
    const rows = await withUserContext(getDb(), session.userId, async (tx) => {
      const conds = [];
      if (task) conds.push(eq(specs.taskId, task));
      if (workstream) conds.push(eq(specs.workstreamId, workstream));
      let q = tx.select(META).from(specs);
      if (conds.length) q = q.where(and(...conds));
      return q.orderBy(desc(specs.updatedAt));
    });
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { title, content = '', task, workstream, note = '' } = req.body ?? {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title required', message: 'Title is required.' });
    }
    const hasTask = !!(task && String(task).trim());
    const hasWs = !!(workstream && String(workstream).trim());
    if (hasTask === hasWs) {
      return res.status(400).json({
        error: 'exactly one target required',
        message: 'Attach the spec to exactly one of a task or a workstream.',
      });
    }
    const result = await withUserContext(getDb(), session.userId, async (tx) => {
      let taskId = null;
      let workstreamId = null;
      if (hasTask) {
        const t = await tx.select().from(tasks).where(eq(tasks.id, task)).limit(1);
        if (!t.length) return { notFound: 'task' };
        taskId = t[0].id;
      } else {
        const ws = await tx.select().from(workstreams)
          .where(or(eq(workstreams.id, workstream), eq(workstreams.slug, workstream))).limit(1);
        if (!ws.length) return { notFound: 'workstream' };
        workstreamId = ws[0].id;
      }
      const [spec] = await tx.insert(specs).values({
        title: title.trim(), content, version: 1, taskId, workstreamId,
        createdVia: 'ui', userId: session.userId,
      }).returning();
      await tx.insert(specRevisions).values({
        specId: spec.id, version: 1, title: title.trim(), content, note,
        createdVia: 'ui', userId: session.userId,
      });
      return { spec };
    });
    if (result.notFound) {
      return res.status(404).json({ error: 'not found', message: `Unknown ${result.notFound}.` });
    }
    return res.status(201).json(result.spec);
  }

  return methodNotAllowed(res, 'GET, POST');
});
