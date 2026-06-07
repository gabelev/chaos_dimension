// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users, tasks, oauthClients, agentTokens, agents } from '../../src/db/schema.js';
import handler from '../../api/me/onboarding.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

function makeReq({ method = 'GET', body, session }) {
  const req = { method, body, headers: {}, cookies: {} };
  req.__sessionOverride = session;
  return req;
}

function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
  return res;
}

describeMaybe('GET/POST /api/me/onboarding', () => {
  let userId;
  let otherUserId;
  let bystanderId;

  beforeAll(async () => {
    const db = getDb();
    userId = createId();
    otherUserId = createId();
    bystanderId = createId();
    await db.insert(users).values([
      { id: userId, email: `onboard-${userId}@test`, name: 'Coach User', passwordHash: null },
      { id: otherUserId, email: `onboard-${otherUserId}@test`, name: 'Other', passwordHash: null },
      { id: bystanderId, email: `onboard-${bystanderId}@test`, name: 'Bystander', passwordHash: null },
    ]);
  });

  afterAll(async () => {
    if (!userId || !otherUserId || !bystanderId) return;
    const db = getDb();
    await db.delete(tasks).where(eq(tasks.userId, userId));
    await db.delete(oauthClients).where(eq(oauthClients.userId, userId));
    await db.delete(agentTokens).where(eq(agentTokens.userId, userId));
    await db.delete(agents).where(eq(agents.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, otherUserId));
    await db.delete(users).where(eq(users.id, bystanderId));
  });

  it('returns all-false for a fresh user', async () => {
    const req = makeReq({ method: 'GET', session: { authed: true, userId } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      coach_dismissed: false,
      has_connected_ai: false,
      has_mcp_created_task: false,
    });
  });

  it('flips has_connected_ai true when an oauth client exists', async () => {
    const db = getDb();
    await db.insert(oauthClients).values({
      clientId: `client-${userId}`,
      name: 'Test Client',
      redirectUris: ['https://example/cb'],
      tokenEndpointAuthMethod: 'none',
      userId,
    });
    const req = makeReq({ method: 'GET', session: { authed: true, userId } });
    const res = makeRes();
    await handler(req, res);
    expect(res.body.has_connected_ai).toBe(true);
  });

  it('flips has_mcp_created_task true when a task has createdVia=mcp', async () => {
    const db = getDb();
    await db.insert(tasks).values({
      title: 'mcp-made',
      workstream: 'second-seat',
      column: 'backlog',
      createdVia: 'mcp',
      userId,
    });
    const req = makeReq({ method: 'GET', session: { authed: true, userId } });
    const res = makeRes();
    await handler(req, res);
    expect(res.body.has_mcp_created_task).toBe(true);
  });

  it('does not count tasks created by another user', async () => {
    // The primary user already has an mcp task from the previous test.
    // The bystander has zero mcp tasks of their own — querying as the
    // bystander should not see anyone else's mcp tasks leak in.
    const req = makeReq({ method: 'GET', session: { authed: true, userId: bystanderId } });
    const res = makeRes();
    await handler(req, res);
    expect(res.body.has_mcp_created_task).toBe(false);
    expect(res.body.has_connected_ai).toBe(false);
  });

  it('dismiss flips coach_dismissed=true', async () => {
    const req = makeReq({
      method: 'POST',
      body: { action: 'dismiss' },
      session: { authed: true, userId },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);

    const getReq = makeReq({ method: 'GET', session: { authed: true, userId } });
    const getRes = makeRes();
    await handler(getReq, getRes);
    expect(getRes.body.coach_dismissed).toBe(true);
  });

  it('reset flips coach_dismissed=false', async () => {
    const req = makeReq({
      method: 'POST',
      body: { action: 'reset' },
      session: { authed: true, userId },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);

    const getReq = makeReq({ method: 'GET', session: { authed: true, userId } });
    const getRes = makeRes();
    await handler(getReq, getRes);
    expect(getRes.body.coach_dismissed).toBe(false);
  });

  it('returns 401 without a session', async () => {
    const req = makeReq({ method: 'GET', session: null });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
