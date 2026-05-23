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
import { agents } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq } from 'drizzle-orm';

const ALLOWED = ['name', 'status', 'taskId', 'startedAt', 'log'];

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method !== 'PATCH') return methodNotAllowed(res, 'PATCH');

  const updates = {};
  for (const k of ALLOWED) {
    if (k in (req.body ?? {})) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'no fields to update', message: 'No fields provided.' });
  }

  const row = await withUserContext(getDb(), session.userId, async (tx) => {
    const [updated] = await tx.update(agents).set(updates).where(eq(agents.id, id)).returning();
    return updated;
  });
  if (!row) return res.status(404).json({ error: 'not found', message: 'Agent not found.' });
  return res.status(200).json(row);
});
