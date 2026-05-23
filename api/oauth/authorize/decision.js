// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../../src/db/client.js';
import { oauthClients, oauthEvents } from '../../../src/db/schema.js';
import { issueAuthCode } from '../../../src/lib/oauthCodes.js';
import { verifyPayload } from '../../../src/lib/oauthCrypto.js';
import { getSession } from '../../../src/lib/requireAuth.js';

export async function handleDecision({ session, body, db, sessionSecret }) {
  if (!session?.authed) return { status: 401, body: { error: 'unauthorized' } };
  const csrf = verifyPayload(body?.csrf, sessionSecret);
  if (!csrf?.req) return { status: 400, body: { error: 'invalid_csrf' } };
  const req = verifyPayload(csrf.req, sessionSecret);
  if (!req) return { status: 400, body: { error: 'invalid_request' } };

  const decision = body.decision === 'allow' ? 'allow' : 'deny';
  const url = new URL(req.redirect_uri);

  if (decision === 'deny') {
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('state', req.state);
    await db.insert(oauthEvents).values({ clientId: req.client_id, type: 'consent_deny', detail: {} }).returning();
    return { status: 200, body: { redirect: url.toString() } };
  }

  const { code } = await issueAuthCode(db, {
    clientId: req.client_id,
    redirectUri: req.redirect_uri,
    codeChallenge: req.code_challenge,
    codeChallengeMethod: 'S256',
    scope: req.scope,
    state: req.state,
  });

  await db.insert(oauthEvents).values({ clientId: req.client_id, type: 'consent_allow', detail: {} }).returning();

  // Consent is the linkage event: stamp the client's owner from the session.
  // Idempotent via WHERE user_id IS NULL so re-consent never overwrites.
  await db
    .update(oauthClients)
    .set({ userId: session.userId })
    .where(and(eq(oauthClients.clientId, req.client_id), isNull(oauthClients.userId)));

  url.searchParams.set('code', code);
  url.searchParams.set('state', req.state);
  return { status: 200, body: { redirect: url.toString() } };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const out = await handleDecision({
    session,
    body: req.body,
    db: getDb(),
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  res.status(out.status).json(out.body);
}
