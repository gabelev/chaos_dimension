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
import { getDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { verifyPassword } from '../src/lib/passwords.js';
import { getSession } from '../src/lib/requireAuth.js';
import { checkRateLimit, ipBucket } from '../src/lib/oauthRateLimit.js';
import { withErrors, methodNotAllowed } from '../src/lib/apiHandler.js';

async function defaultLookupUserByEmail(email) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function handleLogin(req, res, ctx = {}) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'invalid', message: 'Email and password are required.' });
  }

  // Rate limit per IP — 5/minute. Brute-force protection for the password
  // field. Use the same Postgres-backed limiter as signup/oauth.
  const ip = ipBucket('', req).split(':')[1] || 'unknown';
  const rl = await checkRateLimit(ctx.db ?? getDb(), {
    bucket: `login:${ip}`,
    limit: 5,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many login attempts. Try again in a moment.' });
  }

  const lookup = ctx.lookupUserByEmail ?? defaultLookupUserByEmail;
  const user = await lookup(email);
  // Same error message whether the email is unknown or the password is
  // wrong — avoids account enumeration.
  const INVALID = { status: 401, body: { error: 'invalid_credentials', message: 'Invalid email or password.' } };
  if (!user || !user.passwordHash) {
    return res.status(INVALID.status).json(INVALID.body);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(INVALID.status).json(INVALID.body);
  }

  const session = await getSession(req, res);
  session.authed = true;
  session.userId = user.id;
  session.iat = Date.now();
  await session.save();
  return res.status(200).json({ ok: true, userId: user.id });
}

export default withErrors(handleLogin);
