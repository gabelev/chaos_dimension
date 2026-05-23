// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
// tests/api/multi-tenant-isolation.test.js
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import { withUserContext } from '../../src/lib/userContext.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('multi-tenant isolation (live DB + RLS)', () => {
  let db, userA, userB, marker;
  beforeAll(async () => {
    db = getDb();
    marker = `iso-${createId()}`;
    // users is not RLS-scoped, so plain inserts work.
    const [a] = await db.insert(users).values({ email: `iso-a-${createId()}@test.invalid`, name: 'A' }).returning();
    const [b] = await db.insert(users).values({ email: `iso-b-${createId()}@test.invalid`, name: 'B' }).returning();
    userA = a.id; userB = b.id;
  }, 30000);

  it('user A cannot see user B tasks', async () => {
    // User A creates a workstream + a task (tasks.workstream references workstreams.id).
    const wsA = createId();
    await withUserContext(db, userA, async (tx) => {
      await tx.execute(sql`INSERT INTO workstreams (id, label, color, icon, user_id) VALUES (${wsA}, 'A-only', '#000', 'x', ${userA})`);
      await tx.execute(sql`INSERT INTO tasks (id, title, workstream, "column", user_id) VALUES (${createId()}, ${marker}, ${wsA}, 'backlog', ${userA})`);
    });

    // User B queries for that exact task — RLS must hide it.
    const seenByB = await withUserContext(db, userB, async (tx) => {
      const r = await tx.execute(sql`SELECT id, title FROM tasks WHERE title = ${marker}`);
      return r.rows ?? r;
    });
    expect(seenByB).toEqual([]);

    // User A CAN see their own task (sanity — proves the test isn't passing vacuously).
    const seenByA = await withUserContext(db, userA, async (tx) => {
      const r = await tx.execute(sql`SELECT id, title FROM tasks WHERE title = ${marker}`);
      return r.rows ?? r;
    });
    expect(seenByA.length).toBe(1);
  }, 30000);

  it('a query outside withUserContext returns zero rows (RLS denies)', async () => {
    const r = await db.execute(sql`SELECT id FROM tasks WHERE title = ${marker}`);
    const rows = r.rows ?? r;
    expect(rows.length).toBe(0);
  }, 30000);

  it('RLS WITH CHECK rejects an insert stamped with a different user_id', async () => {
    // Inside user A's context, try to insert a row owned by user B.
    let rejected = false;
    try {
      await withUserContext(db, userA, async (tx) => {
        const wsX = createId();
        await tx.execute(sql`INSERT INTO workstreams (id, label, color, icon, user_id) VALUES (${wsX}, 'sneaky', '#000', 'x', ${userB})`);
      });
    } catch (e) {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }, 30000);
});
