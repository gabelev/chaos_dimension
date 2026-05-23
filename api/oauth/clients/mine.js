// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../../../src/db/client.js';
import { oauthClients } from '../../../src/db/schema.js';
import { requireAuth } from '../../../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../../../src/lib/apiHandler.js';

// GET /api/oauth/clients/mine
// Returns OAuth clients linked to the signed-in user. Used by the Connect
// AI walk-through (Connect.jsx) to verify when a Claude Desktop or ChatGPT
// connector completes its consent flow. oauth_clients is not RLS-scoped,
// so the explicit WHERE user_id = ? is the scope.
export default withErrors(async function handle(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  const session = await requireAuth(req, res);
  if (!session) return;

  const rows = await getDb()
    .select({
      id: oauthClients.id,
      clientId: oauthClients.clientId,
      name: oauthClients.name,
      createdAt: oauthClients.createdAt,
      lastUsedAt: oauthClients.lastUsedAt,
      redirectUris: oauthClients.redirectUris,
    })
    .from(oauthClients)
    .where(eq(oauthClients.userId, session.userId))
    .orderBy(desc(oauthClients.createdAt));

  return res.status(200).json(rows);
});
