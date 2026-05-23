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
import { getDb } from '../src/db/client.js';
import { waitlist, users } from '../src/db/schema.js';
import { checkRateLimit, ipBucket } from '../src/lib/oauthRateLimit.js';
import { getSession } from '../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../src/lib/apiHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOTE = 1000;

function validate(body) {
  if (!body || typeof body !== 'object') return 'body required';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RE.test(email)) return 'valid email required';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 200) : '';
  return { email, name, note, source };
}

export async function handlePost({ db, body, ip }) {
  // Honeypot: a real form's `hp` field is hidden via CSS, so a non-empty
  // value almost certainly means a bot filled the form. Silently return
  // success without writing — no signal to whoever's crawling.
  if (body && typeof body === 'object' && typeof body.hp === 'string' && body.hp.trim() !== '') {
    return { status: 200, body: { ok: true } };
  }

  const v = validate(body);
  if (typeof v === 'string') {
    return { status: 400, body: { error: 'invalid', message: v } };
  }

  const rl = await checkRateLimit(db, {
    bucket: `waitlist:${ip}`,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!rl.allowed) {
    return { status: 429, body: { error: 'rate_limited', message: 'Try again later.' } };
  }

  try {
    await db.insert(waitlist).values({
      email: v.email,
      name: v.name || null,
      note: v.note || null,
      source: v.source || null,
    });
  } catch (err) {
    // Duplicate on the partial unique index (email + invited=false) is a
    // no-op success — don't leak which emails are already on the list.
    if (String(err?.message || '').includes('waitlist_email_pending_uniq')
        || String(err?.code) === '23505') {
      return { status: 200, body: { ok: true } };
    }
    throw err;
  }

  return { status: 200, body: { ok: true } };
}

export async function handleGet({ db, session, ownerEmail }) {
  if (!session?.authed || !session?.userId) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  // Owner-only: resolve the owner row by CHAOS_OWNER_EMAIL and require
  // the caller's userId to match. Cheap; users isn't RLS-scoped.
  if (!ownerEmail) {
    return { status: 500, body: { error: 'CHAOS_OWNER_EMAIL not configured' } };
  }
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1);
  const ownerId = rows[0]?.id;
  if (!ownerId || session.userId !== ownerId) {
    return { status: 403, body: { error: 'forbidden' } };
  }

  const list = await db
    .select()
    .from(waitlist)
    .orderBy(desc(waitlist.createdAt));
  return { status: 200, body: list };
}

export const config = { runtime: 'nodejs' };

export default withErrors(async function handle(req, res) {
  const db = getDb();
  if (req.method === 'POST') {
    const ip = ipBucket('', req).split(':')[1] || 'unknown';
    const out = await handlePost({ db, body: req.body, ip });
    return res.status(out.status).json(out.body);
  }
  if (req.method === 'GET') {
    const session = await getSession(req, res);
    const out = await handleGet({ db, session, ownerEmail: process.env.CHAOS_OWNER_EMAIL });
    return res.status(out.status).json(out.body);
  }
  return methodNotAllowed(res, 'POST, GET');
});
