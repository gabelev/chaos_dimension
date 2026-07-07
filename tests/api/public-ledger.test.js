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

import { describe, it, expect, beforeAll } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users, workstreams, tasks, specs } from '../../src/db/schema.js';
import { withUserContext, withPublicContext } from '../../src/lib/userContext.js';
import { handleGet } from '../../api/public/[workstream].js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describe('public ledger (offline)', () => {
  it('workstreams schema has the isPublic column', () => {
    expect(workstreams.isPublic).toBeDefined();
  });

  it('rejects a missing workstream ref without touching the db', async () => {
    const out = await handleGet({ db: null, ref: '' });
    expect(out.status).toBe(400);
  });
});

describeMaybe('public ledger (live DB + RLS)', () => {
  let db, userId, pubWsId, pubSlug, privWsId, privSlug, pubTaskId;

  beforeAll(async () => {
    db = getDb();
    const [u] = await db.insert(users)
      .values({ email: `pub-${createId()}@test.invalid`, name: 'Pub' }).returning();
    userId = u.id;
    pubWsId = createId();
    privWsId = createId();
    pubSlug = `pub-ledger-${createId()}`;
    privSlug = `priv-ledger-${createId()}`;
    await withUserContext(db, userId, async (tx) => {
      await tx.insert(workstreams).values({
        id: pubWsId, label: 'Public Ledger', color: '#000', icon: 'x', slug: pubSlug, userId, isPublic: true,
      });
      await tx.insert(workstreams).values({
        id: privWsId, label: 'Private', color: '#000', icon: 'x', slug: privSlug, userId,
      });
      const [t] = await tx.insert(tasks)
        .values({ title: 'public task', workstream: pubWsId, column: 'backlog', userId }).returning();
      pubTaskId = t.id;
      await tx.insert(tasks).values({ title: 'private task', workstream: privWsId, column: 'backlog', userId });
      await tx.insert(specs).values({ title: 'ws spec', workstreamId: pubWsId, content: 'c1', userId });
      await tx.insert(specs).values({ title: 'task spec', taskId: pubTaskId, content: 'c2', userId });
      await tx.insert(specs).values({ title: 'private spec', workstreamId: privWsId, content: 'c3', userId });
    });
  }, 30000);

  it('serves a public workstream by slug with tasks and specs, no user ids', async () => {
    const out = await handleGet({ db, ref: pubSlug });
    expect(out.status).toBe(200);
    expect(out.body.workstream.id).toBe(pubWsId);
    expect(out.body.tasks.map((t) => t.title)).toEqual(['public task']);
    expect(out.body.specs.map((s) => s.title).sort()).toEqual(['task spec', 'ws spec']);
    // No user data leakage anywhere in the payload.
    const json = JSON.stringify(out.body);
    expect(json).not.toContain(userId);
    expect(json).not.toContain('userId');
  }, 30000);

  it('serves the same workstream by id', async () => {
    const out = await handleGet({ db, ref: pubWsId });
    expect(out.status).toBe(200);
    expect(out.body.workstream.slug).toBe(pubSlug);
  }, 30000);

  it('404s for a private workstream — indistinguishable from nonexistent', async () => {
    const priv = await handleGet({ db, ref: privSlug });
    const none = await handleGet({ db, ref: `no-such-${createId()}` });
    expect(priv.status).toBe(404);
    expect(none.status).toBe(404);
    expect(priv.body).toEqual(none.body);
  }, 30000);

  it('public context sees only public workstreams', async () => {
    const rows = await withPublicContext(db, (tx) => tx.select().from(workstreams));
    expect(rows.every((w) => w.isPublic)).toBe(true);
    expect(rows.some((w) => w.id === pubWsId)).toBe(true);
    expect(rows.some((w) => w.id === privWsId)).toBe(false);
  }, 30000);

  it('public context cannot write — RLS rejects the insert', async () => {
    await expect(withPublicContext(db, async (tx) => {
      await tx.insert(tasks).values({ title: 'nope', workstream: pubWsId, column: 'backlog', userId });
    })).rejects.toThrow(/row-level security/);
  }, 30000);
});
