import { getDb } from '../../src/db/client.js';
import { agents } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';

export default async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const db = getDb();
  const rows = await db.select().from(agents);
  return res.status(200).json(rows);
}
