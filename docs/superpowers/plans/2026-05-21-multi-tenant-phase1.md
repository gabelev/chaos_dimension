# Multi-tenant Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every domain row belong to one user, enforce ownership via Postgres RLS + query-layer scoping, with exactly one user (the existing owner) bootstrapped from `CHAOS_OWNER_EMAIL`. Existing Claude Code, OAuth, dashboard, and tests must keep working.

**Architecture:** Add a `users` table. Add `user_id NOT NULL REFERENCES users(id) ON DELETE CASCADE` to every domain table. Enable RLS with a policy `user_id = current_setting('app.current_user_id', true)::text`. App code wraps every DB call in `withUserContext(db, userId, fn)`, which opens a transaction and `SET LOCAL`s the session var. Auth lookups (`mcpAuth.authenticateBearer`, `requireAuth`) return `userId` alongside the existing fields.

**Tech Stack:** Drizzle + Neon (HTTP driver with multi-statement transactions), `iron-session`, vitest, Vercel serverless functions. No new prod dependencies.

**Spec:** `docs/superpowers/specs/2026-05-21-multi-tenant-phase1-design.md`

---

## Ordering principle

Each task leaves the app in a working state. Schema changes are forward-compatible (new columns are nullable) until the migration script lands. The migration script flips on RLS and NOT NULL constraints atomically. App-code changes thread `userId` through every layer **before** RLS is enabled, so by the time RLS is on, every handler is already scoped.

Run order on dev / prod:
1. Land tasks 1-12 (code-only, no schema effect on prod yet).
2. Run `npm run db:push` on dev to apply the schema additions.
3. Run `npm run db:migrate-multi-tenant` on dev to bootstrap the owner, backfill, rekey workstreams, install RLS.
4. After dev passes the e2e test, run the same migration on prod.

---

### Task 1: Schema additions (users table + nullable user_id columns)

**Files:**
- Modify: `src/db/schema.js`
- Test: `tests/lib/multiTenantSchema.test.js` (new)

- [ ] **Step 1: Write the failing test**

```js
// tests/lib/multiTenantSchema.test.js
import { describe, it, expect } from 'vitest';
import {
  users, tasks, workstreams, agents, agentTokens, runs, oauthClients,
} from '../../src/db/schema.js';

describe('multi-tenant schema additions', () => {
  it('exports a users table', () => {
    expect(users).toBeDefined();
  });
  it('adds user_id columns to every scoped table', () => {
    // Drizzle exposes columns under the camelCase JS name.
    expect(tasks.userId).toBeDefined();
    expect(workstreams.userId).toBeDefined();
    expect(agents.userId).toBeDefined();
    expect(agentTokens.userId).toBeDefined();
    expect(runs.userId).toBeDefined();
    expect(oauthClients.userId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/multiTenantSchema.test.js`
Expected: FAIL — `users` not exported, `tasks.userId` undefined.

- [ ] **Step 3: Add `users` table + `userId` columns**

Edit `src/db/schema.js`. After the existing `// OAuth tables` block, append:

```js
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

Then add `userId: text('user_id')` (nullable for now — the migration script flips this to NOT NULL after backfill) to each of these existing table definitions:
- `tasks` — add as the last column.
- `workstreams` — add as the last column.
- `agents` — add as the last column.
- `agentTokens` — add as the last column.
- `runs` — add as the last column.
- `oauthClients` — add as the last column.

Do NOT add `.references(...)` yet. The migration script adds the FK constraint after backfilling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/multiTenantSchema.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite to confirm no regression**

Run: `npx vitest run`
Expected: all existing tests still pass (the new nullable column is invisible to existing code).

- [ ] **Step 6: Apply schema to your dev DB**

Run: `npm run db:push`
Expected: drizzle-kit applies the changes. Accept any prompts about the new column / table additions.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.js tests/lib/multiTenantSchema.test.js
git commit -m "$(cat <<'EOF'
db: add users table + nullable user_id columns on scoped tables

Phase 1 schema scaffolding. user_id is nullable until the migration
script backfills existing rows and flips it to NOT NULL with FK.
No app behavior change yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `withUserContext` helper

**Files:**
- Create: `src/lib/userContext.js`
- Test: `tests/lib/userContext.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/lib/userContext.test.js
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
    // Outside the transaction, the LOCAL setting is gone.
    const after = await db.execute(sql`SELECT current_setting('app.current_user_id', true) AS uid`);
    const value = after.rows?.[0]?.uid ?? after[0]?.uid;
    expect(value === null || value === '').toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/userContext.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/userContext.js`**

```js
import { sql } from 'drizzle-orm';

// Wrap DB work in a transaction that sets app.current_user_id LOCAL
// to the transaction. Postgres RLS policies on scoped tables read this
// session var to enforce per-user isolation.
//
// The third arg to set_config (true) makes it LOCAL — the value is gone
// the moment the transaction commits.
export async function withUserContext(db, userId, fn) {
  if (!userId) throw new Error('withUserContext: userId required');
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/userContext.test.js`
Expected: PASS (2 tests, or 2 skipped if DATABASE_URL is unset).

- [ ] **Step 5: Commit**

```bash
git add src/lib/userContext.js tests/lib/userContext.test.js
git commit -m "$(cat <<'EOF'
oauth: withUserContext helper — set app.current_user_id LOCAL in tx

Foundation for query-layer + RLS scoping. Every API handler and MCP
tool wraps its DB work in withUserContext(db, userId, fn). The set
is LOCAL to the transaction so it can't leak across requests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migration script `scripts/migrate-multi-tenant.js`

**Files:**
- Create: `scripts/migrate-multi-tenant.js`
- Modify: `package.json` (add `db:migrate-multi-tenant` script)
- Test: `tests/scripts/migrate-multi-tenant.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/scripts/migrate-multi-tenant.test.js
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
  });

  it('backfills user_id on every scoped table', async () => {
    await runMigration();
    const missingTasks = await db.execute(sql`SELECT COUNT(*)::int AS n FROM tasks WHERE user_id IS NULL`);
    const n = missingTasks.rows?.[0]?.n ?? missingTasks[0]?.n;
    expect(n).toBe(0);
  });

  it('enables RLS on tasks (visible in pg_tables)', async () => {
    await runMigration();
    const result = await db.execute(sql`
      SELECT rowsecurity FROM pg_tables WHERE tablename = 'tasks'
    `);
    const enabled = result.rows?.[0]?.rowsecurity ?? result[0]?.rowsecurity;
    expect(enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scripts/migrate-multi-tenant.test.js`
Expected: FAIL — script not found.

- [ ] **Step 3: Implement `scripts/migrate-multi-tenant.js`**

```js
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
    // 1. Insert owner if not present.
    const ownerId = createId();
    await tx.execute(sql`
      INSERT INTO users (id, email, name)
      VALUES (${ownerId}, ${email}, 'Owner')
      ON CONFLICT (email) DO NOTHING
    `);
    const rows = await tx.execute(sql`SELECT id FROM users WHERE email = ${email}`);
    const owner = (rows.rows?.[0]?.id ?? rows[0]?.id);
    if (!owner) throw new Error('owner row not found after insert');

    // 2. Backfill user_id on every scoped table.
    for (const table of SCOPED_TABLES) {
      await tx.execute(sql.raw(`UPDATE ${table} SET user_id = '${owner}' WHERE user_id IS NULL`));
    }

    // 3. Workstream rekey: existing rows have string ids; reissue as cuids.
    //    Done in two passes to preserve tasks.workstream FK pointers.
    const wsRows = await tx.execute(sql`SELECT id FROM workstreams WHERE id NOT LIKE '__cuid_%'`);
    const wsList = wsRows.rows ?? wsRows;
    for (const ws of wsList) {
      const oldId = ws.id;
      // Skip if already cuid-shaped (24 chars, all lowercase alphanumeric).
      if (/^[a-z0-9]{24}$/.test(oldId)) continue;
      const newId = createId();
      await tx.execute(sql`UPDATE tasks SET workstream = ${newId} WHERE workstream = ${oldId}`);
      await tx.execute(sql`UPDATE workstreams SET id = ${newId} WHERE id = ${oldId}`);
    }

    // 4. Lock in NOT NULL + FK on user_id (idempotent via IF NOT EXISTS pattern).
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

    // 5. Enable RLS + policies. CREATE POLICY is not idempotent; use a guard.
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

// CLI entry — `node scripts/migrate-multi-tenant.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then((r) => { console.log('migration complete', r); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Register script in `package.json`**

In `package.json` scripts, add:
```json
"db:migrate-multi-tenant": "node scripts/migrate-multi-tenant.js",
```

- [ ] **Step 5: Run the migration once against dev DB**

Run: `npm run db:migrate-multi-tenant`
Expected: prints `migration complete { ownerId: 'cuid…' }`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/scripts/migrate-multi-tenant.test.js`
Expected: PASS (3 tests). Idempotency confirmed.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate-multi-tenant.js tests/scripts/migrate-multi-tenant.test.js package.json
git commit -m "$(cat <<'EOF'
oauth: migration script — owner bootstrap, backfill, rekey, RLS install

Idempotent. Reads CHAOS_OWNER_EMAIL. Inserts owner if missing,
backfills user_id on every scoped table, re-keys workstreams from
string slugs to cuids (preserving tasks.workstream FK), locks in
NOT NULL + FK, enables RLS with isolation policy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Session shape — add `userId` to iron-session

**Files:**
- Modify: `api/login.js`
- Modify: `src/lib/requireAuth.js`
- Test: extend `tests/api/login.test.js`

- [ ] **Step 1: Write the failing test**

In `tests/api/login.test.js`, add a new test inside the existing describe:

```js
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
    // Stub the owner lookup so the test doesn't need a live DB.
    await handleLogin(req, res, {
      lookupOwner: async (email) => ({ id: 'owner-cuid', email, name: 'Owner' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.userId).toBe('owner-cuid');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/login.test.js`
Expected: FAIL — `res.body.userId` undefined.

- [ ] **Step 3: Update `api/login.js`**

Read the current file. The existing `handleLogin(req, res)` checks the password and creates a session with `authed: true`. Modify it to:
1. Look up the owner by `CHAOS_OWNER_EMAIL`.
2. Store `userId: owner.id` in the session.
3. Return `{ ok: true, userId: owner.id }`.
4. Accept an optional 3rd arg `ctx` with `lookupOwner(email)` for test injection.

```js
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { verifyPassword } from '../src/lib/passwords.js';
import { getSession } from '../src/lib/requireAuth.js';

async function defaultLookupOwner(email) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function handleLogin(req, res, ctx = {}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const password = req.body?.password;
  if (!password) return res.status(400).json({ error: 'password required' });
  const ok = await verifyPassword(password, process.env.CHAOS_PASSWORD_HASH || '');
  if (!ok) return res.status(401).json({ error: 'invalid password' });

  const lookup = ctx.lookupOwner ?? defaultLookupOwner;
  const ownerEmail = process.env.CHAOS_OWNER_EMAIL;
  if (!ownerEmail) return res.status(500).json({ error: 'CHAOS_OWNER_EMAIL not configured' });
  const owner = await lookup(ownerEmail);
  if (!owner) return res.status(500).json({ error: 'owner row missing — run db:migrate-multi-tenant' });

  const session = await getSession(req, res);
  session.authed = true;
  session.userId = owner.id;
  await session.save();
  return res.status(200).json({ ok: true, userId: owner.id });
}

export default handleLogin;
```

- [ ] **Step 4: Update `src/lib/requireAuth.js`**

Confirm `requireAuth` already returns the full session. No change needed — the session now carries `userId` automatically.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/api/login.test.js`
Expected: PASS (4 tests — 3 original + 1 new).

Also re-run the full suite:
Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/login.js tests/api/login.test.js
git commit -m "$(cat <<'EOF'
auth: session now carries userId; login looks up owner by CHAOS_OWNER_EMAIL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `mcpAuth.js` — return `userId` from both lookups

**Files:**
- Modify: `src/lib/mcpAuth.js`
- Test: extend `tests/lib/mcpAuth.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/mcpAuth.test.js`:

```js
  it('returns userId from the agent-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(async () => ({ agentId: 'a1', agentName: 'macbook', userId: 'user-1' })),
      lookupOauthAccessToken: vi.fn(),
    };
    const out = await authenticateBearer({ headers: { authorization: 'Bearer cd_legacy' } }, ctx);
    expect(out.userId).toBe('user-1');
  });

  it('returns userId from the OAuth-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(),
      lookupOauthAccessToken: vi.fn(async () => ({ clientId: 'c1', clientName: 'Claude Desktop', agentId: 'a1', userId: 'user-2' })),
    };
    const out = await authenticateBearer({ headers: { authorization: 'Bearer cd_oat_xyz' } }, ctx);
    expect(out.userId).toBe('user-2');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/mcpAuth.test.js`
Expected: FAIL — `out.userId` undefined.

- [ ] **Step 3: Update `defaultLookupAgentToken` in `src/lib/mcpAuth.js`**

Modify the select to include `agentTokens.userId`:
```js
async function defaultLookupAgentToken(db, token) {
  const rows = await db
    .select({
      agentId: agentTokens.agentId,
      tokenId: agentTokens.id,
      revoked: agentTokens.revoked,
      agentName: agents.name,
      userId: agentTokens.userId,
    })
    .from(agentTokens)
    .innerJoin(agents, eq(agents.id, agentTokens.agentId))
    .where(and(eq(agentTokens.tokenHash, hashAgentToken(token)), eq(agentTokens.revoked, false)))
    .limit(1);
  if (!rows.length) return null;
  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, rows[0].tokenId)).catch(() => {});
  return { agentId: rows[0].agentId, agentName: rows[0].agentName, userId: rows[0].userId };
}
```

- [ ] **Step 4: Update `defaultLookupOauthAccessToken` in the same file**

Add `userId: oauthClients.userId` to the select, and include it in the returned object:
```js
async function defaultLookupOauthAccessToken(db, token) {
  const rows = await db
    .select({
      tokenId: oauthAccessTokens.id,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
      revokedAt: oauthAccessTokens.revokedAt,
      clientName: oauthClients.name,
      clientRowId: oauthClients.id,
      agentId: oauthClients.agentId,
      userId: oauthClients.userId,
    })
    .from(oauthAccessTokens)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthAccessTokens.clientId))
    .where(eq(oauthAccessTokens.tokenHash, hashOauthToken(token)))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  if (r.revokedAt) return null;
  if (new Date(r.expiresAt).getTime() < Date.now()) return null;

  let agentId = r.agentId;
  if (!agentId) {
    const [created] = await db.insert(agents).values({ name: r.clientName, status: 'idle', userId: r.userId }).returning();
    agentId = created.id;
    await db.update(oauthClients).set({ agentId }).where(eq(oauthClients.id, r.clientRowId));
  }

  db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, r.tokenId)).catch(() => {});
  return { clientId: r.clientId, clientName: r.clientName, agentId, userId: r.userId };
}
```

Note: the auto-provisioned agent row now also gets `userId` set.

- [ ] **Step 5: Update `authenticateBearer` to surface `userId`**

In the same file, modify the `kind === 'access'` and `kind === 'agent'` branches:

```js
  if (kind === 'access') {
    const lookup = ctx.lookupOauthAccessToken ?? ((t) => defaultLookupOauthAccessToken(db, t));
    const hit = await lookup(token);
    if (!hit) return null;
    return { agentId: hit.agentId, agentName: hit.clientName, userId: hit.userId };
  }

  if (kind === 'agent') {
    const lookup = ctx.lookupAgentToken ?? ((t) => defaultLookupAgentToken(db, t));
    const hit = await lookup(token);
    if (!hit) return null;
    return { agentId: hit.agentId, agentName: hit.agentName, userId: hit.userId };
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/lib/mcpAuth.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mcpAuth.js tests/lib/mcpAuth.test.js
git commit -m "$(cat <<'EOF'
auth: authenticateBearer returns userId from both bearer paths

Agent-token path: select agent_tokens.user_id directly.
OAuth path: select oauth_clients.user_id via the existing join.
Lazy synthetic agent provisioning also stamps user_id.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Thread `userId` through `api/mcp.js` and `runTool`

**Files:**
- Modify: `api/mcp.js`
- Modify: `src/lib/mcpTools.js` (each tool's signature gains `ctx.userId`)
- Test: extend `tests/lib/mcpTools.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/mcpTools.test.js`:

```js
  it('passes ctx.userId through to tool implementations', async () => {
    const fake = makeFakeDb({ workstreams: [], tasks: [], agents: [] });
    const calls = [];
    const _origDb = fake;
    // Wrap fake so we can capture the ctx the tool received.
    const result = await runTool('list_workstreams', {}, { db: fake, agentId: 'a1', agentName: 'x', userId: 'user-1', __spy: (ctx) => calls.push(ctx) });
    expect(Array.isArray(result)).toBe(true);
    // ctx propagation is covered indirectly — the explicit check is in
    // the integration test for cross-user isolation.
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/mcpTools.test.js`
Expected: PASS for now if `runTool` already accepts a `userId` in ctx — but the integration leg is wired in Task 7. This test is a smoke check that the signature flows.

Note: if the existing `runTool` signature does not accept `userId`, the test will pass vacuously; that's fine. The behavioral check is in Task 7.

- [ ] **Step 3: Update `api/mcp.js` to pass `userId`**

Find the `buildServer({ agentId: auth.agentId, agentName: auth.agentName })` call and update it to:
```js
const server = buildServer({ agentId: auth.agentId, agentName: auth.agentName, userId: auth.userId });
```

And in `buildServer`, update the destructure + the `runTool` call:
```js
function buildServer(ctx) {
  const server = new Server(...);
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await runTool(request.params.name, request.params.arguments ?? {}, ctx);
      ...
```

(The `ctx` object now includes `userId` so it flows automatically.)

- [ ] **Step 4: Update `runTool` and each tool in `src/lib/mcpTools.js`**

The exact change in each tool: wrap its DB work in `withUserContext(ctx.db ?? getDb(), ctx.userId, async (tx) => { ... })`. Use `tx` as the db handle inside the closure.

Apply this pattern to **every** tool in `src/lib/mcpTools.js`:
- `list_workstreams`
- `list_tasks`
- `get_task`
- `create_task`
- `update_task`
- `claim_task`
- `report_progress`

Example for `list_tasks`:
```js
import { withUserContext } from './userContext.js';

async function list_tasks_impl(args, ctx) {
  return withUserContext(ctx.db ?? getDb(), ctx.userId, async (tx) => {
    const rows = await tx.select().from(tasks); // RLS scopes
    return rows;
  });
}
```

For `create_task`:
```js
async function create_task_impl(args, ctx) {
  return withUserContext(ctx.db ?? getDb(), ctx.userId, async (tx) => {
    const [row] = await tx.insert(tasks).values({
      ...args,
      userId: ctx.userId, // belt: also stamp explicitly
    }).returning();
    return row;
  });
}
```

For each tool, ensure inserts include `userId: ctx.userId`. RLS suspenders + explicit stamp = no surprises.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: all pass.

The existing `mcpTools.test.js` uses a fake DB without RLS. To keep those tests green, the fake DB returned by `makeFakeDb` must implement a `transaction(fn)` method that just calls `fn(self)`. Add that to the helper if missing:

```js
function makeFakeDb({ workstreams = [], tasks = [], agents = [] } = {}) {
  const self = { /* existing methods */ };
  self.transaction = async (fn) => fn(self);
  self.execute = async () => ({ rows: [] }); // for the set_config call
  return self;
}
```

- [ ] **Step 6: Commit**

```bash
git add api/mcp.js src/lib/mcpTools.js tests/lib/mcpTools.test.js
git commit -m "$(cat <<'EOF'
mcp: thread userId through ctx; every tool wraps queries in withUserContext

Each tool implementation now opens a transaction, sets app.current_user_id
LOCAL, and runs its queries within. Inserts also stamp user_id explicitly
as belt + suspenders.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wrap each REST API handler in `withUserContext`

**Files (one task per file group — keep commits focused):**
- Modify: `api/tasks/index.js`, `api/tasks/[id].js`
- Modify: `api/workstreams/index.js`, `api/workstreams/[id].js` (whichever exist)
- Modify: `api/agents/index.js`, `api/agents/[id].js`
- Modify: `api/agent-tokens/index.js`, `api/agent-tokens/[id].js`

- [ ] **Step 1: Inventory the handlers**

Run: `ls api/tasks api/workstreams api/agents api/agent-tokens`

For each handler file, the pattern is:
1. `const session = await requireAuth(req, res);` (already exists)
2. Wrap the DB body in `withUserContext(getDb(), session.userId, async (tx) => { ... })`.
3. Use `tx` instead of the raw `db` inside.
4. For inserts: also include `userId: session.userId` in the values object.

- [ ] **Step 2: Update each handler**

Example for `api/tasks/index.js`'s POST handler (creating a task):
```js
import { getDb } from '../../src/db/client.js';
import { withUserContext } from '../../src/lib/userContext.js';
import { requireAuth } from '../../src/lib/requireAuth.js';
import { tasks } from '../../src/db/schema.js';

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  if (req.method === 'POST') {
    const row = await withUserContext(getDb(), session.userId, async (tx) => {
      const [created] = await tx.insert(tasks).values({
        ...req.body,
        userId: session.userId,
      }).returning();
      return created;
    });
    return res.status(201).json(row);
  }
  // ... existing GET / etc, each wrapped the same way
}
```

Apply this transformation to **every** REST handler under `api/tasks`, `api/workstreams`, `api/agents`, `api/agent-tokens`. Use `git grep -l "getDb" api/` to confirm coverage.

- [ ] **Step 3: Update `mintTokenLogic` in `api/agent-tokens/index.js`**

The mint logic creates a new `agent` row when none exists for the label. Make sure both that insert and the `agent_tokens` insert include `userId: session.userId`.

- [ ] **Step 4: Run tests to verify nothing regressed**

Run: `npx vitest run`
Expected: all pass. Update any test using `mintTokenLogic` to pass `userId` in the body or context.

- [ ] **Step 5: Commit**

```bash
git add api/
git commit -m "$(cat <<'EOF'
api: wrap every scoped REST handler in withUserContext

Tasks, workstreams, agents, agent-tokens routes now open a per-request
transaction with app.current_user_id set. Inserts include user_id
explicitly so the row passes RLS WITH CHECK.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: OAuth consent → stamp `oauth_clients.user_id`

**Files:**
- Modify: `api/oauth/authorize/decision.js`
- Test: extend `tests/api/oauth-authorize-decision.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/api/oauth-authorize-decision.test.js`:

```js
  it('stamps oauth_clients.user_id on allow', async () => {
    const db = memoryDb();
    db.state.clients = [{ clientId: 'c1', userId: null }];
    db.update = () => ({
      set: (patch) => ({
        where: async () => {
          if ('userId' in patch && db.state.clients[0].userId === null) {
            db.state.clients[0].userId = patch.userId;
          }
        },
      }),
    });
    const csrf = signPayload({ req: goodReq }, sessionSecret, 60);
    const out = await handleDecision({
      session: { authed: true, userId: 'owner-cuid' },
      body: { csrf, decision: 'allow' },
      db,
      sessionSecret,
    });
    expect(out.status).toBe(200);
    expect(db.state.clients[0].userId).toBe('owner-cuid');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/oauth-authorize-decision.test.js`
Expected: FAIL — `userId` not stamped.

- [ ] **Step 3: Update `handleDecision` in `api/oauth/authorize/decision.js`**

After the existing `issueAuthCode` call on the allow branch, add:

```js
import { oauthClients } from '../../../src/db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// ... inside handleDecision, on the allow branch, after issueAuthCode:
await db
  .update(oauthClients)
  .set({ userId: session.userId })
  .where(and(eq(oauthClients.clientId, req.client_id), isNull(oauthClients.userId)));
```

The `isNull(userId)` guard makes this idempotent — re-consent never overwrites an existing linkage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/oauth-authorize-decision.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/oauth/authorize/decision.js tests/api/oauth-authorize-decision.test.js
git commit -m "$(cat <<'EOF'
oauth: stamp oauth_clients.user_id from session on allow

Consent IS the linkage event. Idempotent via `WHERE user_id IS NULL`
so re-consent never overwrites the original consenter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: End-to-end cross-user isolation test

**Files:**
- Create: `tests/api/multi-tenant-isolation.test.js`

- [ ] **Step 1: Write the test**

```js
// tests/api/multi-tenant-isolation.test.js
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users, tasks } from '../../src/db/schema.js';
import { withUserContext } from '../../src/lib/userContext.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('multi-tenant isolation (live DB + RLS)', () => {
  let db, userA, userB;
  beforeAll(async () => {
    db = getDb();
    // Create two fake users for the test (cleaned up below).
    const [a] = await db.insert(users).values({ email: `iso-a-${createId()}@test.invalid`, name: 'A' }).returning();
    const [b] = await db.insert(users).values({ email: `iso-b-${createId()}@test.invalid`, name: 'B' }).returning();
    userA = a.id; userB = b.id;
  });

  it('user A cannot see user B tasks', async () => {
    // We need a workstream owned by A (since tasks reference it).
    const wsA = createId();
    await withUserContext(db, userA, async (tx) => {
      await tx.execute(sql`INSERT INTO workstreams (id, label, color, icon, user_id) VALUES (${wsA}, 'A-only', '#000', 'x', ${userA})`);
      await tx.execute(sql`INSERT INTO tasks (id, title, workstream, "column", user_id) VALUES (${createId()}, 'secret A task', ${wsA}, 'backlog', ${userA})`);
    });

    const seenByB = await withUserContext(db, userB, async (tx) => {
      const r = await tx.execute(sql`SELECT id, title FROM tasks WHERE title = 'secret A task'`);
      return r.rows ?? r;
    });

    expect(seenByB).toEqual([]);
  });

  it('a query outside withUserContext returns zero rows (RLS denies)', async () => {
    const r = await db.execute(sql`SELECT id FROM tasks WHERE title = 'secret A task'`);
    const rows = r.rows ?? r;
    expect(rows.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `npx vitest run tests/api/multi-tenant-isolation.test.js`
Expected: PASS (2 tests). If the RLS denial doesn't fire, re-check that Task 3's migration script enabled RLS on `tasks`.

- [ ] **Step 3: Commit**

```bash
git add tests/api/multi-tenant-isolation.test.js
git commit -m "$(cat <<'EOF'
test: live-DB cross-user isolation + RLS deny outside withUserContext

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Update OAuth e2e test for the new userId plumbing

**Files:**
- Modify: `tests/api/oauth-e2e.test.js`

- [ ] **Step 1: Update the e2e**

The existing e2e walks register → authorize → consent → token → MCP bearer auth → refresh. After Task 8, the consent step stamps `oauth_clients.user_id` from the session. The e2e was using a stub session without `userId`. Add it:

In each `handleAuthorize` / `handlePending` / `handleDecision` call where `session: { authed: true }`, change to:
```js
session: { authed: true, userId: process.env.CHAOS_OWNER_USER_ID || /* fetched */ }
```

Then resolve the owner's id at `beforeAll`:
```js
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
let ownerId;
beforeAll(async () => {
  db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, process.env.CHAOS_OWNER_EMAIL)).limit(1);
  ownerId = rows[0]?.id;
});
```

Use `ownerId` in every session stub.

After Task 8, the `authenticateBearer` call inside the e2e returns `userId` too — assert it:
```js
expect(who.userId).toBe(ownerId);
```

- [ ] **Step 2: Run the e2e**

Run: `npx vitest run tests/api/oauth-e2e.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/api/oauth-e2e.test.js
git commit -m "$(cat <<'EOF'
test: oauth-e2e threads owner userId through session stubs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Update existing tool/handler tests for the threaded `userId`

**Files:**
- Modify: any test under `tests/api/` or `tests/lib/` that calls an API handler or a tool implementation directly.

- [ ] **Step 1: Inventory tests to update**

Run: `grep -rl "requireAuth\|runTool\|handleLogin\|handleRegister\|handleAuthorize" tests/`

For each test that constructs a session or a ctx object, add `userId: 'test-user-id'` (or fetch the owner id if it's a live-DB test).

For tool tests using `makeFakeDb`, the `transaction(fn)` shim added in Task 6 means tools work as before; just pass `userId: 'test-user'` in the ctx.

- [ ] **Step 2: Run the full suite**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "$(cat <<'EOF'
test: thread userId through all existing test fixtures

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Smoke-test the full stack on Neon

- [ ] **Step 1: Run the full test suite against the real DB**

```bash
npm test
```
Expected: all suites pass, including `multi-tenant-isolation.test.js` and the OAuth e2e.

- [ ] **Step 2: `npm run build`**

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Manually verify Claude Code still works (unchanged behavior)**

If you have a `cd_...` token already minted, fire one MCP tool call from your Claude Code session (e.g. `list_workstreams`). It should still return your workstreams.

If anything fails, the most likely culprit is a missed `withUserContext` wrap or an insert that forgot `userId`. Both will surface as either empty results (read) or a "new row violates row-level security policy" error (write).

- [ ] **Step 4: Manually verify Claude Desktop OAuth still works**

In Claude Desktop, run `/mcp` and call a tool against the chaos-dimension connector. Should work transparently.

- [ ] **Step 5: Update CD task**

Use `mcp__chaos-dimension__update_task` with `id="plisycxk06znc3ow7nz3amru"`, `column="done"`, and notes pointing at this plan + the spec + the commit range.

---

## File map (reference)

| Path | New / Modified | Responsibility |
| --- | --- | --- |
| `src/db/schema.js` | Modified | Adds `users`, adds nullable `user_id` to scoped tables. |
| `src/lib/userContext.js` | New | `withUserContext(db, userId, fn)` helper. |
| `scripts/migrate-multi-tenant.js` | New | Idempotent migration: owner insert, backfill, workstream rekey, NOT NULL, FK, RLS, policies. |
| `package.json` | Modified | `db:migrate-multi-tenant` script. |
| `api/login.js` | Modified | Looks up owner via `CHAOS_OWNER_EMAIL`, sets `session.userId`. |
| `src/lib/mcpAuth.js` | Modified | Both lookups return `userId`; `authenticateBearer` surfaces it. |
| `api/mcp.js` | Modified | Passes `userId` into `buildServer` → `runTool` ctx. |
| `src/lib/mcpTools.js` | Modified | Each tool wraps queries in `withUserContext`. Inserts stamp `userId`. |
| `api/tasks/*` | Modified | Wrap in `withUserContext`; inserts stamp `userId`. |
| `api/workstreams/*` | Modified | Same. |
| `api/agents/*` | Modified | Same. |
| `api/agent-tokens/*` | Modified | Same. `mintTokenLogic` stamps `userId` on both the agent and the token row. |
| `api/oauth/authorize/decision.js` | Modified | Stamps `oauth_clients.user_id` on Allow. |
| `tests/lib/multiTenantSchema.test.js` | New | Schema export smoke test. |
| `tests/lib/userContext.test.js` | New | `withUserContext` round-trip. |
| `tests/scripts/migrate-multi-tenant.test.js` | New | Migration idempotency + RLS state assertion. |
| `tests/api/multi-tenant-isolation.test.js` | New | Cross-user RLS deny. |
| Various existing tests | Modified | Thread `userId` through stubs. |

## Spec coverage check

| Spec requirement | Implemented in |
| --- | --- |
| `users` table | Task 1 |
| `user_id` on every scoped table | Task 1 |
| `withUserContext` helper | Task 2 |
| Owner-bootstrap from `CHAOS_OWNER_EMAIL` | Task 3 |
| Backfill + NOT NULL + FK | Task 3 |
| Workstream slug → cuid rekey | Task 3 |
| RLS + isolation policy on every scoped table | Task 3 |
| Session carries `userId` | Task 4 |
| Login looks up owner | Task 4 |
| Auth lookups return `userId` | Task 5 |
| MCP tools scoped via `withUserContext` | Task 6 |
| REST handlers scoped via `withUserContext` | Task 7 |
| OAuth consent stamps `oauth_clients.user_id` | Task 8 |
| Cross-user isolation test (RLS deny) | Task 9 |
| Existing tests still pass | Tasks 10–11 |
| Migration idempotency test | Task 3 |
| Smoke on Neon | Task 12 |
