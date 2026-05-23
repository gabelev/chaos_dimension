// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { describe, it, expect } from 'vitest';
import { handlePost, handleGet } from '../../api/waitlist.js';

function makeFakeDb({ existingEmails = [], rateAllowed = true, owner = null } = {}) {
  const state = { waitlist: [], inserted: [] };
  const tableNameOf = (t) => t?.[Symbol.for('drizzle:Name')] || t?.name || '';

  const makeChain = () => {
    let table = '';
    const rowsFor = () => {
      if (table === 'oauth_rate_limits') {
        return rateAllowed ? [] : [{ id: 'r0', bucket: 'x', windowStart: new Date(), count: 999 }];
      }
      if (table === 'users') return owner ? [owner] : [];
      if (table === 'waitlist') return state.waitlist;
      return [];
    };
    const chain = {
      from: (t) => { table = tableNameOf(t); return chain; },
      where: () => chain,
      // Drizzle's orderBy / where chains are awaitable directly. Make
      // them thenables so `await db.select().from(t).orderBy(...)` resolves.
      orderBy: () => Promise.resolve(rowsFor()),
      limit: async () => rowsFor(),
      values: (v) => {
        if (table === 'oauth_rate_limits') {
          chain._inserted = [{ id: 'rl' }];
          return chain;
        }
        // Simulate the partial unique index: reject if email is already
        // in state.waitlist with invited=false.
        if (existingEmails.includes(v.email)) {
          const e = new Error('duplicate key value violates unique constraint "waitlist_email_pending_uniq"');
          e.code = '23505';
          throw e;
        }
        state.waitlist.push({ ...v, id: `w-${state.waitlist.length + 1}`, invited: false, created_at: new Date() });
        state.inserted.push(v);
        return chain;
      },
      set: () => chain,
      returning: async () => chain._inserted || [],
    };
    return chain;
  };

  const api = {
    state,
    select: () => makeChain(),
    insert: (t) => { const c = makeChain(); c.from(t); return c; },
    update: (t) => { const c = makeChain(); c.from(t); return c; },
  };
  api.transaction = async (fn) => fn(api);
  return api;
}

describe('POST /api/waitlist (handlePost)', () => {
  it('returns 400 on missing email', async () => {
    const out = await handlePost({ db: makeFakeDb(), body: {}, ip: '1.1.1.1' });
    expect(out.status).toBe(400);
  });

  it('returns 400 on invalid email', async () => {
    const out = await handlePost({ db: makeFakeDb(), body: { email: 'not-an-email' }, ip: '1.1.1.1' });
    expect(out.status).toBe(400);
  });

  it('happy path inserts and returns ok', async () => {
    const db = makeFakeDb();
    const out = await handlePost({ db, body: { email: 'a@b.com', name: 'A', note: 'curious' }, ip: '1.1.1.1' });
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    expect(db.state.inserted).toHaveLength(1);
    expect(db.state.inserted[0].email).toBe('a@b.com');
    expect(db.state.inserted[0].note).toBe('curious');
  });

  it('honeypot field silently drops (returns ok, does NOT insert)', async () => {
    const db = makeFakeDb();
    const out = await handlePost({ db, body: { email: 'a@b.com', hp: 'spambot' }, ip: '1.1.1.1' });
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    expect(db.state.inserted).toHaveLength(0);
  });

  it('duplicate email returns ok (no enumeration leak)', async () => {
    const db = makeFakeDb({ existingEmails: ['a@b.com'] });
    const out = await handlePost({ db, body: { email: 'a@b.com' }, ip: '1.1.1.1' });
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    // Insert was attempted but rejected — second attempt also returns ok.
    expect(db.state.inserted).toHaveLength(0);
  });

  it('rate-limited returns 429', async () => {
    const db = makeFakeDb({ rateAllowed: false });
    const out = await handlePost({ db, body: { email: 'a@b.com' }, ip: '1.1.1.1' });
    expect(out.status).toBe(429);
  });

  it('lowercases + trims the email', async () => {
    const db = makeFakeDb();
    const out = await handlePost({ db, body: { email: '  A@B.COM  ' }, ip: '1.1.1.1' });
    expect(out.status).toBe(200);
    expect(db.state.inserted[0].email).toBe('a@b.com');
  });
});

describe('GET /api/waitlist (handleGet)', () => {
  it('returns 401 when not authed', async () => {
    const out = await handleGet({ db: makeFakeDb(), session: null, ownerEmail: 'o@x.com' });
    expect(out.status).toBe(401);
  });

  it('returns 401 when session has no userId', async () => {
    const out = await handleGet({ db: makeFakeDb(), session: { authed: true }, ownerEmail: 'o@x.com' });
    expect(out.status).toBe(401);
  });

  it('returns 403 for a logged-in non-owner', async () => {
    const out = await handleGet({
      db: makeFakeDb({ owner: { id: 'owner-id' } }),
      session: { authed: true, userId: 'someone-else' },
      ownerEmail: 'o@x.com',
    });
    expect(out.status).toBe(403);
  });

  it('returns the list as owner', async () => {
    const db = makeFakeDb({ owner: { id: 'owner-id' } });
    // Pre-populate with a row.
    db.state.waitlist.push({ id: 'w-1', email: 'a@b.com', name: 'A', invited: false });
    const out = await handleGet({
      db,
      session: { authed: true, userId: 'owner-id' },
      ownerEmail: 'o@x.com',
    });
    expect(out.status).toBe(200);
    expect(Array.isArray(out.body)).toBe(true);
    expect(out.body).toHaveLength(1);
    expect(out.body[0].email).toBe('a@b.com');
  });
});
