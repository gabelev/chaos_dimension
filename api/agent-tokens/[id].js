import { getDb } from '../../src/db/client.js';
import { agentTokens } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { eq } from 'drizzle-orm';

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method !== 'DELETE') return methodNotAllowed(res, 'DELETE');

  const db = getDb();
  const [row] = await db
    .update(agentTokens)
    .set({ revoked: true })
    .where(eq(agentTokens.id, id))
    .returning();

  if (!row) return res.status(404).json({ error: 'not found', message: 'Token not found.' });
  return res.status(200).json({ ok: true });
});
