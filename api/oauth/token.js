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
import { oauthClients, oauthEvents } from '../../src/db/schema.js';
import { hashToken, verifyPkceS256 } from '../../src/lib/oauthCrypto.js';
import { consumeAuthCode } from '../../src/lib/oauthCodes.js';
import { issueTokenPair, rotateRefreshToken, revokeChain } from '../../src/lib/oauthTokens.js';

async function loadClient(db, clientId) {
  const rows = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

async function authenticateClient(db, body) {
  const clientId = body.client_id;
  if (!clientId) return { ok: false, error: 'invalid_client' };
  const client = await loadClient(db, clientId);
  if (!client) return { ok: false, error: 'invalid_client' };
  if (client.tokenEndpointAuthMethod === 'client_secret_post') {
    if (!body.client_secret || hashToken(body.client_secret) !== client.clientSecretHash) {
      return { ok: false, error: 'invalid_client' };
    }
  }
  return { ok: true, client };
}

export async function handleToken({ db, body }) {
  const grant = body?.grant_type;

  if (grant === 'authorization_code') {
    const auth = await authenticateClient(db, body);
    if (!auth.ok) return { status: 401, body: { error: auth.error } };

    const consumed = await consumeAuthCode(db, body.code);
    if (!consumed.ok) {
      if (consumed.reason === 'reuse' && consumed.row?.clientId) {
        await revokeChain(db, consumed.row.clientId);
        await db.insert(oauthEvents).values({ clientId: consumed.row.clientId, type: 'reuse_detected', detail: { source: 'auth_code' } }).returning();
      }
      return { status: 400, body: { error: 'invalid_grant', reason: consumed.reason } };
    }
    const row = consumed.row;
    if (row.clientId !== auth.client.clientId) return { status: 400, body: { error: 'invalid_grant' } };
    if (row.redirectUri !== body.redirect_uri) return { status: 400, body: { error: 'invalid_grant' } };
    if (!verifyPkceS256(body.code_verifier, row.codeChallenge)) return { status: 400, body: { error: 'invalid_grant', reason: 'pkce' } };

    const pair = await issueTokenPair(db, { clientId: auth.client.clientId, scope: row.scope });
    await db.insert(oauthEvents).values({ clientId: auth.client.clientId, type: 'token_issue', detail: {} }).returning();
    return {
      status: 200,
      body: {
        access_token: pair.access,
        token_type: 'Bearer',
        expires_in: pair.expiresIn,
        refresh_token: pair.refresh,
        scope: row.scope,
      },
    };
  }

  if (grant === 'refresh_token') {
    const auth = await authenticateClient(db, body);
    if (!auth.ok) return { status: 401, body: { error: auth.error } };
    if (!body.refresh_token) return { status: 400, body: { error: 'invalid_request' } };

    const out = await rotateRefreshToken(db, body.refresh_token);
    if (!out.ok) {
      if (out.reason === 'reuse') {
        await db.insert(oauthEvents).values({ clientId: out.clientId, type: 'reuse_detected', detail: { source: 'refresh' } }).returning();
      }
      return { status: 400, body: { error: 'invalid_grant', reason: out.reason } };
    }
    if (out.clientId !== auth.client.clientId) return { status: 400, body: { error: 'invalid_grant' } };

    await db.insert(oauthEvents).values({ clientId: auth.client.clientId, type: 'token_refresh', detail: {} }).returning();
    return {
      status: 200,
      body: {
        access_token: out.access,
        token_type: 'Bearer',
        expires_in: out.expiresIn,
        refresh_token: out.refresh,
        scope: 'mcp',
      },
    };
  }

  return { status: 400, body: { error: 'unsupported_grant_type' } };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const out = await handleToken({ db: getDb(), body: req.body });
  res.status(out.status).json(out.body);
}
