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
import { agents, agentTokens } from '../../src/db/schema.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../src/lib/apiHandler.js';
import { generateToken, hashToken } from '../../src/lib/agentToken.js';
import { eq, and, desc } from 'drizzle-orm';

export async function mintTokenLogic({ db, body, userId }) {
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  if (!label) {
    return { status: 400, body: { error: 'label required', message: 'A label is required.' } };
  }
  // Guard the tenancy invariant. The HTTP handler runs this inside
  // withUserContext (RLS scopes every query), but a caller on a BYPASSRLS
  // connection (the mint-api-key CLI, owner role) has no such backstop — a
  // missing userId would silently insert an unscoped row.
  if (!userId) {
    return { status: 400, body: { error: 'userId required', message: 'A userId is required to mint a token.' } };
  }

  // Each label gets its own agent row, scoped to this user. Reuse if one
  // already exists. The userId filter is redundant under RLS but load-bearing
  // when this runs on a BYPASSRLS connection, where a bare name match could
  // otherwise reuse another user's agent row.
  const existingAgents = await db.select().from(agents)
    .where(and(eq(agents.name, label), eq(agents.userId, userId))).limit(1);
  let agentId;
  if (existingAgents.length) {
    agentId = existingAgents[0].id;
  } else {
    const [created] = await db.insert(agents).values({ name: label, status: 'idle', userId }).returning();
    agentId = created.id;
  }

  const raw = generateToken();
  const [tokenRow] = await db
    .insert(agentTokens)
    .values({ agentId, tokenHash: hashToken(raw), label, userId })
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
    const result = await withUserContext(getDb(), session.userId, async (tx) => {
      return mintTokenLogic({ db: tx, body: req.body, userId: session.userId });
    });
    return res.status(result.status).json(result.body);
  }

  if (req.method === 'GET') {
    const rows = await withUserContext(getDb(), session.userId, async (tx) => {
      return tx
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
    });
    return res.status(200).json(rows);
  }

  return methodNotAllowed(res, 'POST, GET');
});
