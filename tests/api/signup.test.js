// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { describe, it, expect, vi } from 'vitest';
import { handleSignup } from '../../api/signup.js';

// Build a minimal in-memory fake that supports the call shapes signup
// actually uses: select+from+where+limit, insert+values+returning,
// update+set+where+returning, execute, transaction(fn).
function makeFakeDb({ inviteCodeRow = null, allowRateLimit = true, throwUniqueOnInsert = false } = {}) {
  const state = {
    users: [],
    inviteCodes: inviteCodeRow ? [{ ...inviteCodeRow }] : [],
    workstreams: [],
    rateAllowed: allowRateLimit,
  };

  const tableNameOf = (t) => t?.[Symbol.for('drizzle:Name')] || t?.name || '';

  // Generic chain object that responds to whatever the handler calls in
  // either order. We track the "current table" via a closure and resolve
  // operations based on it.
  const makeChain = () => {
    let table = '';
    let updatePatch = null;
    const chain = {
      from: (t) => { table = tableNameOf(t); return chain; },
      where: () => chain,
      limit: async () => {
        if (table === 'invite_codes') return state.inviteCodes;
        if (table === 'oauth_rate_limits') return state.rateAllowed ? [] : [{ id: 'r0', bucket: 'x', windowStart: new Date(), count: 999 }];
        return [];
      },
      values: (v) => {
        if (table === 'users') {
          if (throwUniqueOnInsert) {
            const e = new Error('duplicate key value violates unique constraint "users_email_unique"');
            e.code = '23505';
            throw e;
          }
          const row = { id: `u-${state.users.length + 1}`, ...v };
          state.users.push(row);
          chain._inserted = [row];
        } else if (table === 'workstreams') {
          for (const r of v) state.workstreams.push(r);
          chain._inserted = v;
        } else if (table === 'oauth_rate_limits') {
          chain._inserted = [{ id: 'rl', ...v }];
        }
        return chain;
      },
      set: (patch) => { updatePatch = patch; return chain; },
      returning: async () => {
        if (table === 'invite_codes' && updatePatch) {
          if (!state.inviteCodes[0] || state.inviteCodes[0].claimedAt) return [];
          Object.assign(state.inviteCodes[0], updatePatch);
          return [state.inviteCodes[0]];
        }
        return chain._inserted || [];
      },
    };
    return chain;
  };

  const api = {
    state,
    select: () => makeChain(),
    insert: (table) => {
      const c = makeChain();
      c.from(table);
      return c;
    },
    update: (table) => {
      const c = makeChain();
      c.from(table);
      return c;
    },
    execute: async () => ({ rows: [] }),
  };
  api.transaction = async (fn) => fn(api);
  return api;
}

function makeSession() {
  const s = { authed: false, userId: null, iat: null };
  s.save = vi.fn(async () => {});
  return s;
}

const validBody = () => ({
  email: 'tester@example.com',
  password: 'a-good-password-123',
  invite_code: 'cd_inv_abc123',
});

const validInvite = (over = {}) => ({
  id: 'inv-1',
  code: 'cd_inv_abc123',
  createdById: 'owner',
  claimedByUserId: null,
  claimedAt: null,
  note: '',
  ...over,
});

describe('POST /api/signup (handleSignup)', () => {
  it('returns 400 when body is missing', async () => {
    const out = await handleSignup({ db: makeFakeDb(), body: null, ip: '1.1.1.1', session: makeSession() });
    expect(out.status).toBe(400);
  });

  it('returns 400 on invalid email', async () => {
    const out = await handleSignup({
      db: makeFakeDb(), body: { ...validBody(), email: 'not-an-email' }, ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(400);
    expect(out.body.message).toMatch(/email/i);
  });

  it('returns 400 on short password', async () => {
    const out = await handleSignup({
      db: makeFakeDb(), body: { ...validBody(), password: 'short' }, ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(400);
    expect(out.body.message).toMatch(/password/i);
  });

  it('returns 400 on missing invite code', async () => {
    const out = await handleSignup({
      db: makeFakeDb(), body: { ...validBody(), invite_code: '' }, ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(400);
    expect(out.body.message).toMatch(/invite/i);
  });

  it('returns 400 when invite code is unknown', async () => {
    const out = await handleSignup({
      db: makeFakeDb({ inviteCodeRow: null }), body: validBody(), ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_invite');
  });

  it('returns 400 when invite code is already claimed', async () => {
    const out = await handleSignup({
      db: makeFakeDb({ inviteCodeRow: validInvite({ claimedAt: new Date(), claimedByUserId: 'someone' }) }),
      body: validBody(), ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_invite');
  });

  it('returns 429 when rate-limited', async () => {
    const out = await handleSignup({
      db: makeFakeDb({ inviteCodeRow: validInvite(), allowRateLimit: false }),
      body: validBody(), ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(429);
    expect(out.body.error).toBe('rate_limited');
  });

  it('returns 400 when the email is already taken', async () => {
    const out = await handleSignup({
      db: makeFakeDb({ inviteCodeRow: validInvite(), throwUniqueOnInsert: true }),
      body: validBody(), ip: '1.1.1.1', session: makeSession(),
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('email_taken');
  });

  it('happy path: creates user, claims invite, seeds workstreams, sets session, returns 201', async () => {
    const db = makeFakeDb({ inviteCodeRow: validInvite() });
    const session = makeSession();
    const out = await handleSignup({ db, body: validBody(), ip: '1.1.1.1', session });
    expect(out.status).toBe(201);
    expect(out.body.ok).toBe(true);
    expect(out.body.userId).toBe('u-1');
    // user inserted
    expect(db.state.users).toHaveLength(1);
    expect(db.state.users[0].email).toBe('tester@example.com');
    // invite claimed
    expect(db.state.inviteCodes[0].claimedByUserId).toBe('u-1');
    expect(db.state.inviteCodes[0].claimedAt).toBeInstanceOf(Date);
    // 5 starter workstreams seeded with the new userId
    expect(db.state.workstreams).toHaveLength(5);
    for (const w of db.state.workstreams) expect(w.userId).toBe('u-1');
    // session set + saved
    expect(session.authed).toBe(true);
    expect(session.userId).toBe('u-1');
    expect(session.save).toHaveBeenCalled();
  });
});
