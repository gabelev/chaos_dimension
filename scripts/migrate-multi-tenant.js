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

import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getMigrationDb } from '../src/db/client.js';
import { assertRlsState } from '../src/lib/rlsCheck.js';

// Tables that get NOT NULL user_id + FK + RLS isolation.
const RLS_TABLES = ['tasks', 'workstreams', 'agents', 'runs', 'specs', 'spec_revisions'];

// Local slugify — kept self-contained so this Node script has no frontend deps.
function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'workstream';
}
// oauth_clients keeps a nullable user_id linkage column (stamped at consent),
// but no RLS — the OAuth register endpoint is unauthenticated and must be able
// to insert a client row before any user exists.
//
// agent_tokens keeps a NOT NULL user_id linkage column + FK (the mint endpoint
// always has a session), but no RLS: it's looked up by token_hash before any
// user context exists (it's how the user is resolved during MCP auth), so an
// RLS policy would make every agent-token lookup return zero rows.

export async function runMigration() {
  const email = process.env.CHAOS_OWNER_EMAIL;
  if (!email) throw new Error('CHAOS_OWNER_EMAIL must be set');

  // DDL (ALTER TABLE, CREATE POLICY) requires the owner role — cd_app can't.
  const db = getMigrationDb();
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

    // 1a. Stamp the owner's users.password_hash from CHAOS_PASSWORD_HASH if it
    //     hasn't been set yet. This unifies the owner into the same
    //     {email, password} login flow new users use — no more env-only
    //     direct-compare path in api/login.js. Idempotent (WHERE NULL guard).
    const envHash = process.env.CHAOS_PASSWORD_HASH;
    if (envHash) {
      await tx.execute(sql`
        UPDATE users SET password_hash = ${envHash}
        WHERE id = ${owner} AND password_hash IS NULL
      `);
    }

    // 1b. One-time corrective: an earlier version of this migration RLS-scoped
    //     oauth_clients. Undo that — oauth_clients must stay un-scoped because
    //     POST /api/oauth/register is an unauthenticated Dynamic Client
    //     Registration endpoint with no user session. All three statements are
    //     idempotent (no-op if already in the target state).
    await tx.execute(sql.raw(`ALTER TABLE oauth_clients DISABLE ROW LEVEL SECURITY`));
    await tx.execute(sql.raw(`DROP POLICY IF EXISTS oauth_clients_user_isolation ON oauth_clients`));
    await tx.execute(sql.raw(`ALTER TABLE oauth_clients ALTER COLUMN user_id DROP NOT NULL`));

    // 1c. One-time corrective: an earlier version of this migration RLS-scoped
    //     agent_tokens. Undo that — agent_tokens is looked up by token_hash
    //     before any user context exists (it's how MCP auth resolves the user),
    //     so an RLS policy makes every agent-token lookup return zero rows.
    //     agent_tokens keeps its NOT NULL user_id + FK (the mint endpoint always
    //     has a session). Both statements are idempotent (no-op if already off).
    await tx.execute(sql.raw(`ALTER TABLE agent_tokens DISABLE ROW LEVEL SECURITY`));
    await tx.execute(sql.raw(`DROP POLICY IF EXISTS agent_tokens_user_isolation ON agent_tokens`));

    // 2. Backfill user_id. RLS tables get it; agent_tokens and oauth_clients
    //    also get a backfill so existing rows stay linked to the owner —
    //    oauth_clients's column stays nullable (NULL at registration, stamped
    //    at consent), agent_tokens's becomes NOT NULL below.
    for (const table of [...RLS_TABLES, 'agent_tokens', 'oauth_clients']) {
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

    // 3b. Workstream slug column: human-readable identifier, unique per user.
    //     The rekey above made workstreams.id an opaque cuid; this restores a
    //     stable human handle so MCP tools can accept slug-or-cuid. All steps
    //     idempotent (column add guarded, backfill only fills NULLs, index
    //     guarded). Uniqueness deduped in JS per user_id group.
    await tx.execute(sql.raw(`ALTER TABLE workstreams ADD COLUMN IF NOT EXISTS slug text`));

    const slugRows = await tx.execute(
      sql`SELECT id, label, slug, user_id FROM workstreams`
    );
    const slugList = slugRows.rows ?? slugRows;
    // Group by user_id; track slugs already taken so we can suffix collisions.
    const takenByUser = new Map(); // user_id -> Set(slug)
    for (const ws of slugList) {
      if (ws.slug) {
        if (!takenByUser.has(ws.user_id)) takenByUser.set(ws.user_id, new Set());
        takenByUser.get(ws.user_id).add(ws.slug);
      }
    }
    for (const ws of slugList) {
      if (ws.slug) continue; // already backfilled
      if (!takenByUser.has(ws.user_id)) takenByUser.set(ws.user_id, new Set());
      const taken = takenByUser.get(ws.user_id);
      const base = slugify(ws.label);
      let candidate = base;
      let n = 2;
      while (taken.has(candidate)) {
        candidate = `${base}-${n}`;
        n += 1;
      }
      taken.add(candidate);
      await tx.execute(sql`UPDATE workstreams SET slug = ${candidate} WHERE id = ${ws.id}`);
    }

    await tx.execute(sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS workstreams_user_slug_uniq ON workstreams (user_id, slug)`
    ));

    // 4. Lock NOT NULL + CASCADE FK on user_id — RLS tables plus agent_tokens
    //    (its mint endpoint always has a session, so NOT NULL is safe even
    //    though it isn't RLS-scoped). oauth_clients keeps a nullable user_id
    //    (see note at top of file). Idempotent guard for the FK.
    for (const table of [...RLS_TABLES, 'agent_tokens']) {
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

    // 4b. oauth_clients gets an optional nullable FK referencing users(id) with
    //     ON DELETE SET NULL (not CASCADE) — deleting a user must not delete the
    //     OAuth client rows. The column itself stays nullable.
    await tx.execute(sql.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'oauth_clients_user_id_fk'
        ) THEN
          ALTER TABLE oauth_clients ADD CONSTRAINT oauth_clients_user_id_fk
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `));

    // 5. Enable RLS + policies — RLS tables only. CREATE POLICY is not idempotent;
    //    guard explicitly. FORCE is required so RLS applies to the table owner role
    //    too — without it, Postgres bypasses RLS for the owner (the Neon role).
    for (const table of RLS_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
      await tx.execute(sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`));
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

    // 5b. Spec-specific integrity: FKs to the attachment targets + the
    //     "exactly one target" CHECK. The generic loop above already added
    //     specs_user_id_fk / spec_revisions_user_id_fk; these are the extra
    //     domain FKs and the invariant constraint. All guarded → idempotent.
    //     Skipped cleanly if the specs tables don't exist yet (db:push first).
    const specTables = await tx.execute(sql.raw(
      `SELECT relname FROM pg_class WHERE relname IN ('specs', 'spec_revisions')`
    ));
    const haveSpecs = new Set((specTables.rows ?? specTables).map((r) => r.relname));
    if (haveSpecs.has('specs') && haveSpecs.has('spec_revisions')) {
      const specFks = [
        ['specs', 'specs_workstream_id_fk', 'workstream_id', 'workstreams', 'CASCADE'],
        ['specs', 'specs_task_id_fk', 'task_id', 'tasks', 'CASCADE'],
        ['spec_revisions', 'spec_revisions_spec_id_fk', 'spec_id', 'specs', 'CASCADE'],
      ];
      for (const [table, name, col, ref, onDelete] of specFks) {
        await tx.execute(sql.raw(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = '${name}'
            ) THEN
              ALTER TABLE ${table} ADD CONSTRAINT ${name}
                FOREIGN KEY (${col}) REFERENCES ${ref}(id) ON DELETE ${onDelete};
            END IF;
          END $$;
        `));
      }
      // Exactly one of workstream_id / task_id set (XOR via boolean inequality).
      await tx.execute(sql.raw(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'specs_exactly_one_target'
          ) THEN
            ALTER TABLE specs ADD CONSTRAINT specs_exactly_one_target
              CHECK ((workstream_id IS NULL) <> (task_id IS NULL));
          END IF;
        END $$;
      `));
    }

    // 6. Post-flight assertion. If any of the four scoped tables is missing
    //    RLS enable / force / policy, throw — rolls back the whole tx so the
    //    operator sees a loud failure instead of an apparently-successful
    //    "migration complete" that left the data leaking. The 2026-05-23
    //    incident slipped past because step 5 was assumed to have worked.
    await assertRlsState(tx);

    return { ownerId: owner };
  });
}

// CLI entry.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then((r) => { console.log('migration complete', r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
