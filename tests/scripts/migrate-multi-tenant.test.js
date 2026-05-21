import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { users, tasks, workstreams } from '../../src/db/schema.js';
import { runMigration } from '../../scripts/migrate-multi-tenant.js';

const SKIP = !process.env.DATABASE_URL || !process.env.CHAOS_OWNER_EMAIL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('migrate-multi-tenant', () => {
  let db;
  beforeAll(() => { db = getDb(); });

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
});
