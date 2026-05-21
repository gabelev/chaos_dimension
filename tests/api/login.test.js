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

describe('POST /api/login handler', () => {
  beforeEach(() => {
    process.env.CHAOS_SESSION_SECRET = 'a'.repeat(32);
  });

  it('returns 400 if password missing', async () => {
    const req = { method: 'POST', body: {}, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 on wrong password', async () => {
    process.env.CHAOS_PASSWORD_HASH = await hashPassword('correct');
    const req = { method: 'POST', body: { password: 'wrong' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 on correct password', async () => {
    process.env.CHAOS_PASSWORD_HASH = await hashPassword('correct');
    process.env.CHAOS_OWNER_EMAIL = 'owner@example.com';
    const req = { method: 'POST', body: { password: 'correct' }, headers: {}, cookies: {} };
    const res = mockRes();
    await handleLogin(req, res, {
      lookupOwner: async (email) => ({ id: 'owner-cuid', email, name: 'Owner' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, userId: 'owner-cuid' });
  });

  it('sets userId in the session on successful login', async () => {
    process.env.CHAOS_PASSWORD_HASH = await hashPassword('correct');
    process.env.CHAOS_OWNER_EMAIL = 'owner@example.com';
    const req = {
      method: 'POST',
      body: { password: 'correct' },
      headers: {},
      cookies: {},
    };
    const res = mockRes();
    await handleLogin(req, res, {
      lookupOwner: async (email) => ({ id: 'owner-cuid', email, name: 'Owner' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.userId).toBe('owner-cuid');
  });
});
