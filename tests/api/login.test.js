// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { describe, it, expect, beforeEach } from 'vitest';
import { handleLogin } from '../../api/login.js';
import { hashPassword } from '../../src/lib/passwords.js';

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.getHeader = (k) => res.headers[k];
  return res;
}

// Minimal fake db that satisfies the rate-limit check (always allow).
function makeFakeDb() {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'rl' }] }) }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
}

describe('POST /api/login handler', () => {
  beforeEach(() => {
    process.env.CHAOS_SESSION_SECRET = 'a'.repeat(32);
  });

  it('returns 400 if email is missing', async () => {
    const req = { method: 'POST', body: { password: 'something' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, { db: makeFakeDb() });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 if password is missing', async () => {
    const req = { method: 'POST', body: { email: 'a@b.com' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, { db: makeFakeDb() });
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 on unknown email (same message as wrong password)', async () => {
    const req = { method: 'POST', body: { email: 'nobody@example.com', password: 'whatever' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, {
      db: makeFakeDb(),
      lookupUserByEmail: async () => null,
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 401 on wrong password (same message as unknown email)', async () => {
    const passwordHash = await hashPassword('correct');
    const req = { method: 'POST', body: { email: 'a@b.com', password: 'wrong' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, {
      db: makeFakeDb(),
      lookupUserByEmail: async () => ({ id: 'u1', email: 'a@b.com', passwordHash }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 200 on correct email + password, sets session.userId', async () => {
    const passwordHash = await hashPassword('correct');
    const req = { method: 'POST', body: { email: 'a@b.com', password: 'correct' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, {
      db: makeFakeDb(),
      lookupUserByEmail: async (email) => ({ id: 'u1', email, passwordHash }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: 'u1' });
  });

  it('lowercases + trims email on lookup', async () => {
    const passwordHash = await hashPassword('correct');
    const captured = { email: null };
    const req = { method: 'POST', body: { email: '  A@B.COM  ', password: 'correct' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, {
      db: makeFakeDb(),
      lookupUserByEmail: async (email) => { captured.email = email; return { id: 'u1', email, passwordHash }; },
    });
    expect(res.statusCode).toBe(200);
    expect(captured.email).toBe('a@b.com');
  });

  it('treats a user with null passwordHash as invalid credentials (not as 500)', async () => {
    const req = { method: 'POST', body: { email: 'a@b.com', password: 'whatever' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, {
      db: makeFakeDb(),
      lookupUserByEmail: async () => ({ id: 'u1', email: 'a@b.com', passwordHash: null }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });
});
