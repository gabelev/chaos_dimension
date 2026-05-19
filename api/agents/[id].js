import { getDb } from '../../src/db/client.js';
import { agents } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { eq } from 'drizzle-orm';

const ALLOWED = ['name', 'status', 'taskId', 'startedAt', 'log'];

export default async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const updates = {};
  for (const k of ALLOWED) {
    if (k in (req.body ?? {})) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }

  const db = getDb();
  const [row] = await db.update(agents).set(updates).where(eq(agents.id, id)).returning();
  if (!row) return res.status(404).json({ error: 'not found' });
  return res.status(200).json(row);
}
