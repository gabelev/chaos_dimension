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
import { specs, specRevisions } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq, desc } from 'drizzle-orm';

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    // ?version=N returns that historical revision's full body; otherwise the
    // current spec plus its revision history (metadata only).
    const { version } = req.query ?? {};
    const out = await withUserContext(getDb(), session.userId, async (tx) => {
      if (version != null) {
        const v = Number(version);
        const rows = await tx.select().from(specRevisions)
          .where(eq(specRevisions.specId, id)).orderBy(desc(specRevisions.version));
        return { revision: rows.find((r) => r.version === v) ?? null };
      }
      const rows = await tx.select().from(specs).where(eq(specs.id, id)).limit(1);
      if (!rows.length) return { spec: null };
      const revisions = await tx
        .select({
          version: specRevisions.version,
          title: specRevisions.title,
          note: specRevisions.note,
          createdVia: specRevisions.createdVia,
          createdAt: specRevisions.createdAt,
        })
        .from(specRevisions)
        .where(eq(specRevisions.specId, id))
        .orderBy(desc(specRevisions.version));
      return { spec: { ...rows[0], revisions } };
    });
    if (out.revision !== undefined) {
      if (!out.revision) return res.status(404).json({ error: 'not found', message: 'Revision not found.' });
      return res.status(200).json(out.revision);
    }
    if (!out.spec) return res.status(404).json({ error: 'not found', message: 'Spec not found.' });
    return res.status(200).json(out.spec);
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const hasTitle = typeof body.title === 'string';
    const hasContent = typeof body.content === 'string';
    if (!hasTitle && !hasContent) {
      return res.status(400).json({ error: 'no fields to update', message: 'Provide title and/or content.' });
    }
    const row = await withUserContext(getDb(), session.userId, async (tx) => {
      const rows = await tx.select().from(specs).where(eq(specs.id, id)).limit(1);
      if (!rows.length) return null;
      const current = rows[0];
      const newTitle = hasTitle ? body.title.trim() : current.title;
      const contentChanged = hasContent && body.content !== current.content;
      const updates = { title: newTitle, updatedAt: new Date() };
      if (contentChanged) {
        updates.content = body.content;
        updates.version = current.version + 1;
      }
      const [updated] = await tx.update(specs).set(updates).where(eq(specs.id, id)).returning();
      if (contentChanged) {
        await tx.insert(specRevisions).values({
          specId: current.id, version: updated.version, title: newTitle,
          content: body.content, note: body.note ?? '', createdVia: 'ui', userId: session.userId,
        });
      }
      return updated;
    });
    if (!row) return res.status(404).json({ error: 'not found', message: 'Spec not found.' });
    return res.status(200).json(row);
  }

  if (req.method === 'DELETE') {
    const row = await withUserContext(getDb(), session.userId, async (tx) => {
      await tx.delete(specRevisions).where(eq(specRevisions.specId, id));
      const [deleted] = await tx.delete(specs).where(eq(specs.id, id)).returning();
      return deleted;
    });
    if (!row) return res.status(404).json({ error: 'not found', message: 'Spec not found.' });
    return res.status(200).json({ ok: true });
  }

  return methodNotAllowed(res, 'GET, PATCH, DELETE');
});
