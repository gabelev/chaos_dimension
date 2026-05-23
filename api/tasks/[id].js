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
import { tasks } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq } from 'drizzle-orm';

const ALLOWED_FIELDS = ['title', 'workstream', 'column', 'agentDispatchable', 'priority', 'notes'];

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'PATCH') {
    const updates = {};
    for (const k of ALLOWED_FIELDS) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no fields to update', message: 'No fields provided.' });
    }
    updates.updatedAt = new Date();
    const row = await withUserContext(getDb(), session.userId, async (tx) => {
      const [updated] = await tx.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
      return updated;
    });
    if (!row) return res.status(404).json({ error: 'not found', message: 'Task not found.' });
    return res.status(200).json(row);
  }

  if (req.method === 'DELETE') {
    const row = await withUserContext(getDb(), session.userId, async (tx) => {
      const [deleted] = await tx.delete(tasks).where(eq(tasks.id, id)).returning();
      return deleted;
    });
    if (!row) return res.status(404).json({ error: 'not found', message: 'Task not found.' });
    return res.status(200).json({ ok: true });
  }

  return methodNotAllowed(res, 'PATCH, DELETE');
});
