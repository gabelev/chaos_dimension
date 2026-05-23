// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { agentTokens, agents, oauthAccessTokens, oauthClients } from '../db/schema.js';
import { hashToken as hashAgentToken } from './agentToken.js';
import { detectTokenKind, hashToken as hashOauthToken } from './oauthCrypto.js';
import { withUserContext } from './userContext.js';

async function defaultLookupAgentToken(db, token) {
  // agent_tokens is un-scoped (no RLS): it's looked up by token_hash before any
  // user context exists — this lookup IS how the user is resolved. The agents
  // table, by contrast, stays RLS-scoped, so its name fetch must run inside a
  // withUserContext block once we know the userId.
  const rows = await db
    .select({
      agentId: agentTokens.agentId,
      tokenId: agentTokens.id,
      revoked: agentTokens.revoked,
      userId: agentTokens.userId,
    })
    .from(agentTokens)
    .where(and(eq(agentTokens.tokenHash, hashAgentToken(token)), eq(agentTokens.revoked, false)))
    .limit(1);
  if (!rows.length) return null;
  const { agentId, tokenId, userId } = rows[0];

  // lastUsedAt touch on agent_tokens is un-scoped — a plain update works.
  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, tokenId)).catch(() => {});

  // Fetch the agent name under the resolved user's RLS context.
  let agentName = null;
  if (userId) {
    const agentRows = await withUserContext(db, userId, async (tx) =>
      tx.select({ name: agents.name }).from(agents).where(eq(agents.id, agentId)).limit(1)
    );
    agentName = agentRows[0]?.name ?? null;
  }
  return { agentId, agentName, userId };
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
  // Subsequent calls hit the warm agent_id on oauth_clients. The agents table
  // is RLS-scoped, so the insert must run inside the resolved user's context
  // for the WITH CHECK to pass; the oauth_clients.agentId update can ride along
  // in the same transaction (oauth_clients is un-scoped, so it's fine there).
  let agentId = r.agentId;
  if (!agentId && r.userId) {
    agentId = await withUserContext(db, r.userId, async (tx) => {
      const [created] = await tx
        .insert(agents)
        .values({ name: r.clientName, status: 'idle', userId: r.userId })
        .returning();
      await tx.update(oauthClients).set({ agentId: created.id }).where(eq(oauthClients.id, r.clientRowId));
      return created.id;
    });
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
