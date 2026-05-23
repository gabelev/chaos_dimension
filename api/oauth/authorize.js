// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { oauthClients } from '../../src/db/schema.js';
import { redirectUriAllowed } from '../../src/lib/oauthClients.js';
import { signPayload } from '../../src/lib/oauthCrypto.js';
import { getSession } from '../../src/lib/requireAuth.js';

const REQUIRED = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'scope'];

export async function handleAuthorize({ db, session, query, originalUrl, sessionSecret }) {
  for (const k of REQUIRED) {
    if (!query[k]) return { status: 400, body: { error: 'invalid_request', message: `missing ${k}` } };
  }
  if (query.response_type !== 'code') return { status: 400, body: { error: 'unsupported_response_type' } };
  if (query.code_challenge_method !== 'S256') return { status: 400, body: { error: 'invalid_request', message: 'PKCE S256 required' } };
  if (query.scope !== 'mcp') return { status: 400, body: { error: 'invalid_scope' } };

  const rows = await db.select().from(oauthClients).where(eq(oauthClients.clientId, query.client_id)).limit(1);
  if (!rows.length) return { status: 400, body: { error: 'invalid_client' } };
  const client = rows[0];
  if (!redirectUriAllowed(query.redirect_uri, client.redirectUris)) {
    return { status: 400, body: { error: 'invalid_redirect_uri' } };
  }

  if (!session?.authed) {
    return { status: 302, location: `/login?next=${encodeURIComponent(originalUrl ?? '')}` };
  }

  const req = signPayload(
    {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uri: query.redirect_uri,
      code_challenge: query.code_challenge,
      code_challenge_method: 'S256',
      scope: 'mcp',
      state: query.state,
    },
    sessionSecret,
    5 * 60,
  );
  return { status: 302, location: `/oauth/consent?req=${encodeURIComponent(req)}` };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const result = await handleAuthorize({
    db: getDb(),
    session,
    query: req.query,
    originalUrl: req.url,
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  if (result.location) {
    res.writeHead(result.status, { Location: result.location });
    res.end();
    return;
  }
  res.status(result.status).json(result.body);
}
