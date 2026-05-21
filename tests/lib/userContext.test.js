import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { withUserContext } from '../../src/lib/userContext.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('withUserContext', () => {
  it('sets app.current_user_id LOCAL to the transaction', async () => {
    const db = getDb();
    const read = await withUserContext(db, 'user-abc', async (tx) => {
      const result = await tx.execute(sql`SELECT current_setting('app.current_user_id', true) AS uid`);
      return result.rows?.[0]?.uid ?? result[0]?.uid;
    });
    expect(read).toBe('user-abc');
  });

  it('does not leak the session var outside the transaction', async () => {
    const db = getDb();
    await withUserContext(db, 'user-abc', async () => {});
    const after = await db.execute(sql`SELECT current_setting('app.current_user_id', true) AS uid`);
    const value = after.rows?.[0]?.uid ?? after[0]?.uid;
    expect(value === null || value === '').toBe(true);
  });
});
