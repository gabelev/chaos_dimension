import { getDb } from '../../src/db/client.js';
import { tasks } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { desc } from 'drizzle-orm';

export default async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const db = getDb();

  if (req.method === 'GET') {
    const rows = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { title, workstream, column = 'backlog', agentDispatchable = false, priority = 'med', notes = '' } = req.body ?? {};
    if (!title || !workstream) {
      return res.status(400).json({ error: 'title and workstream required' });
    }
    const [row] = await db.insert(tasks).values({
      title, workstream, column, agentDispatchable, priority, notes,
    }).returning();
    return res.status(201).json(row);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
