import { getDb } from '../../src/db/client.js';
import { agents, agentTokens } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { generateToken, hashToken } from '../../src/lib/agentToken.js';
import { eq, desc } from 'drizzle-orm';

export async function mintTokenLogic({ db, body }) {
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  if (!label) {
    return { status: 400, body: { error: 'label required', message: 'A label is required.' } };
  }

  // Each label gets its own agent row. Reuse if one already exists.
  const existingAgents = await db.select().from(agents).where(eq(agents.name, label)).limit(1);
  let agentId;
  if (existingAgents.length) {
    agentId = existingAgents[0].id;
  } else {
    const [created] = await db.insert(agents).values({ name: label, status: 'idle' }).returning();
    agentId = created.id;
  }

  const raw = generateToken();
  const [tokenRow] = await db
    .insert(agentTokens)
    .values({ agentId, tokenHash: hashToken(raw), label })
    .returning();

  return {
    status: 201,
    body: { token: raw, agentId, tokenId: tokenRow.id, label },
  };
}

export default withErrors(async function handle(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const result = await mintTokenLogic({ db: getDb(), body: req.body });
    return res.status(result.status).json(result.body);
  }

  if (req.method === 'GET') {
    const db = getDb();
    const rows = await db
      .select({
        id: agentTokens.id,
        agentId: agentTokens.agentId,
        label: agentTokens.label,
        createdAt: agentTokens.createdAt,
        lastUsedAt: agentTokens.lastUsedAt,
        revoked: agentTokens.revoked,
      })
      .from(agentTokens)
      .orderBy(desc(agentTokens.createdAt));
    return res.status(200).json(rows);
  }

  return methodNotAllowed(res, 'POST, GET');
});
