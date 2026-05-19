import { getDb } from '../../src/db/client.js';
import { tasks } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { eq } from 'drizzle-orm';

const ALLOWED_FIELDS = ['title', 'workstream', 'column', 'agentDispatchable', 'priority', 'notes'];

export default async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  const db = getDb();

  if (req.method === 'PATCH') {
    const updates = {};
    for (const k of ALLOWED_FIELDS) {
      if (k in (req.body ?? {})) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }
    updates.updatedAt = new Date();
    const [row] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(row);
  }

  if (req.method === 'DELETE') {
    const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
