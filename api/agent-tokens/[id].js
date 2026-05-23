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

  const row = await withUserContext(getDb(), session.userId, async (tx) => {
    const [updated] = await tx
      .update(agentTokens)
      .set({ revoked: true })
      .where(eq(agentTokens.id, id))
      .returning();
    return updated;
  });

  if (!row) return res.status(404).json({ error: 'not found', message: 'Token not found.' });
  return res.status(200).json({ ok: true });
});
