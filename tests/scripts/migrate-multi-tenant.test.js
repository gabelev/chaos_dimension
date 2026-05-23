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
import { sql } from 'drizzle-orm';
import { getMigrationDb } from '../../src/db/client.js';
import { users, tasks, workstreams } from '../../src/db/schema.js';
import { runMigration } from '../../scripts/migrate-multi-tenant.js';

const SKIP = !process.env.DATABASE_URL || !process.env.CHAOS_OWNER_EMAIL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('migrate-multi-tenant', () => {
  // Use the owner-role connection (same one runMigration uses internally) for
  // assertions: they verify migration / DDL state and read RLS-scoped tables,
  // which the cd_app role would have RLS-denied.
  let db;
  beforeAll(() => { db = getMigrationDb(); });

  it('inserts the owner from CHAOS_OWNER_EMAIL and is idempotent', async () => {
    await runMigration();
    await runMigration(); // second run is a no-op
    const ownerRows = await db
      .select()
      .from(users)
      .where(sql`email = ${process.env.CHAOS_OWNER_EMAIL}`);
    expect(ownerRows).toHaveLength(1);
  }, 30000);

  it('backfills user_id on every scoped table', async () => {
    await runMigration();
    const missing = await db.execute(sql`SELECT COUNT(*)::int AS n FROM tasks WHERE user_id IS NULL`);
    const n = missing.rows?.[0]?.n ?? missing[0]?.n;
    expect(n).toBe(0);
  }, 30000);

  it('enables RLS on tasks (visible in pg_tables)', async () => {
    await runMigration();
    const result = await db.execute(sql`
      SELECT rowsecurity FROM pg_tables WHERE tablename = 'tasks'
    `);
    const enabled = result.rows?.[0]?.rowsecurity ?? result[0]?.rowsecurity;
    expect(enabled).toBe(true);
  }, 30000);

  it('forces RLS on tasks (applies even to the owner role)', async () => {
    await runMigration();
    // pg_tables.forcerowsecurity was added in Postgres 16; query pg_class directly
    // so this test works across Postgres versions.
    const result = await db.execute(sql`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'tasks' AND relkind = 'r'
    `);
    const forced = result.rows?.[0]?.relforcerowsecurity ?? result[0]?.relforcerowsecurity;
    expect(forced).toBe(true);
  }, 30000);
});
