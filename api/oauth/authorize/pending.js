// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { signPayload, verifyPayload } from '../../../src/lib/oauthCrypto.js';
import { getSession } from '../../../src/lib/requireAuth.js';

export async function handlePending({ session, req, sessionSecret }) {
  if (!session?.authed) return { status: 401, body: { error: 'unauthorized' } };
  const parsed = verifyPayload(req, sessionSecret);
  if (!parsed) return { status: 400, body: { error: 'invalid_request' } };

  const csrf = signPayload({ req }, sessionSecret, 5 * 60);
  return {
    status: 200,
    body: {
      client_name: parsed.client_name,
      scope: parsed.scope,
      redirect_uri: parsed.redirect_uri,
      csrf,
    },
  };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const out = await handlePending({
    session,
    req: req.query?.req,
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  res.status(out.status).json(out.body);
}
