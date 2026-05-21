import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../src/db/client.js';

const SCOPED_TABLES = ['tasks', 'workstreams', 'agents', 'agent_tokens', 'runs', 'oauth_clients'];

export async function runMigration() {
  const email = process.env.CHAOS_OWNER_EMAIL;
  if (!email) throw new Error('CHAOS_OWNER_EMAIL must be set');

  const db = getDb();
  return db.transaction(async (tx) => {
    // 1. Insert owner if not present (idempotent via ON CONFLICT).
    const ownerId = createId();
    await tx.execute(sql`
      INSERT INTO users (id, email, name)
      VALUES (${ownerId}, ${email}, 'Owner')
      ON CONFLICT (email) DO NOTHING
    `);
    const rows = await tx.execute(sql`SELECT id FROM users WHERE email = ${email}`);
    const owner = rows.rows?.[0]?.id ?? rows[0]?.id;
    if (!owner) throw new Error('owner row not found after insert');

    // 2. Backfill user_id on every scoped table.
    for (const table of SCOPED_TABLES) {
      await tx.execute(sql.raw(`UPDATE ${table} SET user_id = '${owner}' WHERE user_id IS NULL`));
    }

    // 3. Workstream rekey: existing rows have string ids; reissue as cuids.
    //    Skip rows already cuid-shaped so re-running is a no-op.
    const wsRows = await tx.execute(sql`SELECT id FROM workstreams`);
    const wsList = wsRows.rows ?? wsRows;
    for (const ws of wsList) {
      const oldId = ws.id;
      if (/^[a-z0-9]{24}$/.test(oldId)) continue;
      const newId = createId();
      await tx.execute(sql`UPDATE tasks SET workstream = ${newId} WHERE workstream = ${oldId}`);
      await tx.execute(sql`UPDATE workstreams SET id = ${newId} WHERE id = ${oldId}`);
    }

    // 4. Lock NOT NULL + FK on user_id. Idempotent guard for the FK.
    for (const table of SCOPED_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ALTER COLUMN user_id SET NOT NULL`));
      await tx.execute(sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = '${table}_user_id_fk'
          ) THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${table}_user_id_fk
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `));
    }

    // 5. Enable RLS + policies. CREATE POLICY is not idempotent; guard explicitly.
    for (const table of SCOPED_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      await tx.execute(sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${table}' AND policyname = '${table}_user_isolation'
          ) THEN
            CREATE POLICY ${table}_user_isolation ON ${table}
              USING (user_id = current_setting('app.current_user_id', true))
              WITH CHECK (user_id = current_setting('app.current_user_id', true));
          END IF;
        END $$;
      `));
    }

    return { ownerId: owner };
  });
}

// CLI entry.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then((r) => { console.log('migration complete', r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
