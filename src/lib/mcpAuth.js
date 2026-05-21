import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { agentTokens, agents, oauthAccessTokens, oauthClients } from '../db/schema.js';
import { hashToken as hashAgentToken } from './agentToken.js';
import { detectTokenKind, hashToken as hashOauthToken } from './oauthCrypto.js';

async function defaultLookupAgentToken(db, token) {
  const rows = await db
    .select({
      agentId: agentTokens.agentId,
      tokenId: agentTokens.id,
      revoked: agentTokens.revoked,
      agentName: agents.name,
      userId: agentTokens.userId,
    })
    .from(agentTokens)
    .innerJoin(agents, eq(agents.id, agentTokens.agentId))
    .where(and(eq(agentTokens.tokenHash, hashAgentToken(token)), eq(agentTokens.revoked, false)))
    .limit(1);
  if (!rows.length) return null;
  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, rows[0].tokenId)).catch(() => {});
  return { agentId: rows[0].agentId, agentName: rows[0].agentName, userId: rows[0].userId };
}

async function defaultLookupOauthAccessToken(db, token) {
  const rows = await db
    .select({
      tokenId: oauthAccessTokens.id,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
      revokedAt: oauthAccessTokens.revokedAt,
      clientName: oauthClients.name,
      clientRowId: oauthClients.id,
      agentId: oauthClients.agentId,
      userId: oauthClients.userId,
    })
    .from(oauthAccessTokens)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthAccessTokens.clientId))
    .where(eq(oauthAccessTokens.tokenHash, hashOauthToken(token)))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  if (r.revokedAt) return null;
  if (new Date(r.expiresAt).getTime() < Date.now()) return null;

  // Lazily provision a synthetic agent row the first time this client is used.
  // Subsequent calls hit the warm agent_id on oauth_clients.
  let agentId = r.agentId;
  if (!agentId) {
    const [created] = await db.insert(agents).values({ name: r.clientName, status: 'idle', userId: r.userId }).returning();
    agentId = created.id;
    await db.update(oauthClients).set({ agentId }).where(eq(oauthClients.id, r.clientRowId));
  }

  db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, r.tokenId)).catch(() => {});
  return { clientId: r.clientId, clientName: r.clientName, agentId, userId: r.userId };
}

export async function authenticateBearer(req, ctx = {}) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  const db = ctx.db ?? getDb();
  const kind = detectTokenKind(token);

  if (kind === 'access') {
    const lookup = ctx.lookupOauthAccessToken ?? ((t) => defaultLookupOauthAccessToken(db, t));
    const hit = await lookup(token);
    if (!hit) return null;
    return { agentId: hit.agentId, agentName: hit.clientName, userId: hit.userId };
  }

  if (kind === 'agent') {
    const lookup = ctx.lookupAgentToken ?? ((t) => defaultLookupAgentToken(db, t));
    const hit = await lookup(token);
    if (!hit) return null;
    return { agentId: hit.agentId, agentName: hit.agentName, userId: hit.userId };
  }

  return null;
}

export const authenticateMcpRequest = authenticateBearer;
