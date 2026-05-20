import { getDb } from '../../src/db/client.js';
import { agents } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  const db = getDb();
  const rows = await db.select().from(agents);
  return res.status(200).json(rows);
});
