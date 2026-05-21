# Multi-tenant Phase 1 — Tenant Scoping Infrastructure

**Status:** design approved 2026-05-21
**Related CD task:** `plisycxk06znc3ow7nz3amru` ("Multi-tenant data isolation")
**Phase:** 1 of 2. Phase 2 (sign-up / login UX for non-owners) is a separate spec.

## Goal

Make every domain row in Chaos Dimension belong to a single user, and enforce that ownership at the database layer with Postgres Row-Level Security (RLS) plus explicit query-layer scoping. The existing owner becomes "user 1." No new users can sign up yet — that's Phase 2 — but the data model and all enforcement paths are in place so Phase 2 is purely a front-door change.

## Non-goals (deferred to Phase 2)

- Sign-up form.
- Login UI for non-owner users.
- Invite flow.
- Org / team support (rows belong to a user, not an org).
- Account menu UI (the session cookie gains a `userId` field but the dashboard doesn't surface it yet).
- Default-workstream seeding for newly-created users.
- Email verification, password reset, sign-in-with-anything.

## Decisions (locked in)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Scope of Phase 1 | Infrastructure only (no sign-up UX) | Lower risk; provides a clean foundation for Phase 2 to slot identity work onto. |
| Tenant model | Per-user (no orgs); `user_id` on every domain row | Matches the "personal task tracker" framing. Orgs can be added later without re-keying the data. |
| Enforcement | Postgres RLS + query-layer (belt + suspenders) | Database refuses cross-user reads even if app code forgets a WHERE; app code still passes `userId` explicitly for clarity. |
| Owner bootstrap | Migration reads `CHAOS_OWNER_EMAIL` env var | Predictable + idempotent; one env var set in Vercel, owner row inserted at migration time. |
| Workstream identity | Reissue as cuid (was string slug) | Two users can each have a "Research" workstream and they're distinct rows. |

## Architecture

### New table

```js
// src/db/schema.js addition
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'), // nullable; populated in Phase 2 for non-owner users
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Scoped tables (each gains `user_id` NOT NULL FK)

| Table | New column |
| --- | --- |
| `tasks` | `user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `workstreams` | `user_id ...` (workstreams become per-user) |
| `agents` | `user_id ...` |
| `agent_tokens` | `user_id ...` |
| `runs` | `user_id ...` |
| `oauth_clients` | `user_id ...` (the user who clicked Allow on consent) |

### Unchanged

These tables stay un-scoped because they're either children of an already-scoped row or genuinely cross-user:

- `oauth_access_tokens`, `oauth_refresh_tokens`, `oauth_auth_codes` — scope follows their parent `oauth_clients.user_id`. The bearer-lookup join in `mcpAuth.js` returns the inherited `userId`.
- `oauth_events` — audit log; `client_id` is enough to trace ownership.
- `oauth_rate_limits` — IP-keyed counters, not user data.

### Workstream re-keying

Existing `workstreams` rows have hardcoded string IDs (`"research"`, `"studio"`, etc.). The migration:

1. Renames the column `id` → `legacy_slug` (kept for one release in case something references it).
2. Adds a new `id` cuid PK.
3. Rewrites `tasks.workstream` FK references from the legacy slug to the new cuid.

Done inside a single transaction so nothing dangles.

## Migration

A single Drizzle migration (commit by hand because `db:push` can't express the data manipulation). Order matters:

```sql
-- 1. Create users table.
CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

-- 2. Bootstrap the owner from CHAOS_OWNER_EMAIL. Run via a small Node
--    script (`scripts/bootstrap-owner.js`) invoked from package.json
--    so the env var is read in process, not embedded in SQL.
INSERT INTO users (id, email, name)
VALUES ($newId, $CHAOS_OWNER_EMAIL, 'Owner')
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- 3. Add user_id columns (nullable for the backfill).
ALTER TABLE tasks ADD COLUMN user_id text;
ALTER TABLE workstreams ADD COLUMN user_id text;
ALTER TABLE agents ADD COLUMN user_id text;
ALTER TABLE agent_tokens ADD COLUMN user_id text;
ALTER TABLE runs ADD COLUMN user_id text;
ALTER TABLE oauth_clients ADD COLUMN user_id text;

-- 4. Backfill: every existing row belongs to the owner.
WITH owner AS (SELECT id FROM users LIMIT 1)
UPDATE tasks SET user_id = (SELECT id FROM owner);
-- … same for workstreams, agents, agent_tokens, runs, oauth_clients

-- 5. Re-key workstreams (per "Workstream re-keying" above).

-- 6. Lock in NOT NULL + FK on user_id.
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fk
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- … same for each table

-- 7. Enable RLS + policy on every scoped table.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_user_isolation ON tasks
  USING (user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = current_setting('app.current_user_id', true));
-- … same for workstreams, agents, agent_tokens, runs, oauth_clients
```

**Reversibility:** drop policies → drop user_id columns → drop users. The workstream rekey loses original slugs (the `legacy_slug` column hangs around for one release as a cheap escape hatch).

## Application changes

### Session

`iron-session` cookie was `{ authed: true }`. Now `{ authed: true, userId: 'cuid…' }`.

- `api/login.js` looks up owner by `CHAOS_OWNER_EMAIL`, sets `session.userId = owner.id` on successful password match.
- `requireAuth(req, res)` returns the full session including `userId`.
- A session with `authed: true` but no `userId` (impossible after this change, but defensive) is treated as unauthenticated.

### New helper: `withUserContext`

```js
// src/lib/userContext.js
import { sql } from 'drizzle-orm';

export async function withUserContext(db, userId, fn) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
```

Every API handler that reads or writes a scoped table wraps its DB work in `withUserContext`. The third arg to `set_config` (`true`) makes the setting `LOCAL` to the transaction.

### MCP tool runtime

`runTool(name, args, ctx)` already takes a context. Add `ctx.userId`. Each tool body uses `withUserContext(db, ctx.userId, ...)` for its queries.

Tool functions remain stateless; the `userId` flows in via context, not closure.

### Auth lookups (`src/lib/mcpAuth.js`)

- `defaultLookupAgentToken` now selects `agentTokens.userId` and returns it.
- `defaultLookupOauthAccessToken` joins `oauth_clients.user_id` and returns it.
- `authenticateBearer` returns `{ agentId, agentName, userId }`.
- `api/mcp.js` passes `userId` into `buildServer({ agentId, agentName, userId })` and through to each `runTool` call as `ctx.userId`.

### OAuth consent → user linkage

The consent click IS the linkage event. When `api/oauth/authorize/decision.js` receives an Allow decision:

1. Verifies the signed CSRF (existing behavior).
2. Issues the authorization code (existing behavior).
3. **New:** `UPDATE oauth_clients SET user_id = $session.userId WHERE client_id = $... AND user_id IS NULL`. Idempotent (no overwrite once linked, so subsequent consents from the same user are no-ops).

No new column on `oauth_auth_codes`. In Phase 1 the stamped user_id is always the owner; in Phase 2 it varies per consenter.

### Migration script

`scripts/migrate-multi-tenant.js` — one idempotent Node script that:

1. Verifies `CHAOS_OWNER_EMAIL` is set (fails loud if not).
2. Runs `db:push` first to add the new `users` table and the nullable `user_id` columns.
3. Opens a single transaction and executes the data steps in order: insert owner, backfill `user_id` on every scoped table, re-key workstreams, enable RLS, install policies.
4. Asserts every scoped table has zero rows with `user_id IS NULL` before committing.
5. Idempotent: re-running is a no-op (owner insert uses `ON CONFLICT`, backfills check `WHERE user_id IS NULL`, RLS-enable / policy-create check `pg_policies` first).

Run via `npm run db:migrate-multi-tenant`. Deploy order on Vercel: push code → run the script from a developer machine pointed at the prod `DATABASE_URL` → the new code finds the migrated schema on its next invocation.

## Non-regression guarantees

This change must not break existing users (i.e., the single owner). Explicit guarantees:

1. **The existing iron-session cookie keeps working.** Owner's session is automatically upgraded with `userId` on next login. No forced logout.
2. **All existing `cd_...` agent tokens keep working.** Backfilled with owner's `user_id`. The `mintTokenLogic` handler now stamps new tokens with the current session's `userId`.
3. **All existing OAuth clients (and their access + refresh tokens) keep working.** Backfilled with owner's `user_id`.
4. **The MCP endpoint shape doesn't change.** Tools are called with the same args; only the internal context gains `userId`.
5. **The frontend doesn't change.** No new UI in Phase 1. The dashboard renders identically.
6. **Existing tests pass unchanged.** Where they call MCP tools or auth helpers, they're updated to pass a stub `userId` (or use a test-only helper that opens a transaction with the owner's id).
7. **API handlers that forget `withUserContext` fail closed.** Without `app.current_user_id` set, `current_setting(..., true)` returns NULL; the RLS policy `user_id = NULL` evaluates to NULL (never true), so reads return zero rows and writes fail the WITH CHECK with a "new row violates row-level security policy" error. Loud for writes, empty for reads — never a leak. Every handler is audited in the implementation plan.

## Testing strategy

| Layer | Coverage |
| --- | --- |
| Unit | `withUserContext` round-trip: set the var, read it back via `current_setting`. Each tool body, when called with `ctx.userId = A`, only sees A's rows in the fake DB. |
| Integration (live DB) | Insert task as user A (`SET LOCAL app.current_user_id = A`), then in a separate transaction `SET LOCAL ... = B` and confirm `SELECT *` returns zero rows. Repeat for each scoped table. |
| Migration | Take a copy of the current schema seeded with the owner's real rows. Run the migration. Assert: owner row exists with correct email; every row in every scoped table has `user_id` populated; RLS is active (`SELECT * FROM tasks` outside any transaction returns zero rows). |
| Regression | All 20 existing test files keep passing after a mechanical pass to thread `userId` through. Tests touching the live DB are wrapped in a test helper that calls `withUserContext(db, TEST_OWNER_ID, ...)`. |
| Negative | API handler that forgets `withUserContext` returns empty results (verified by deleting the wrapper from one test handler and asserting). RLS blocks cross-user writes via WITH CHECK (test with a deliberately wrong `user_id` insert). |
| Owner-bootstrap | `scripts/bootstrap-owner.js` is idempotent: running twice produces one row. Fails loud if `CHAOS_OWNER_EMAIL` is missing. |

## Risks

1. **Neon serverless + `SET LOCAL`.** Drizzle's `db.transaction(...)` holds the connection for the transaction's lifetime; `SET LOCAL` is scoped to the transaction. Safe within `withUserContext` blocks. **Mitigation:** an integration test that calls `current_setting('app.current_user_id')` inside the transaction to confirm Neon honors it.
2. **Workstream slug → cuid rekey is destructive.** Anyone with bookmarked URLs containing a slug would break. Mitigation: only the owner has this risk today, and `legacy_slug` stays in the table for one release as an escape hatch.
3. **RLS forces every read into a transaction.** Slight latency overhead. Negligible for current traffic; flag if it changes.
4. **Migration ordering on Vercel.** `db:push` runs from the developer's machine, not from Vercel. If a deploy ships with new code that references `users` before the migration runs, the app breaks. Mitigation: a startup health check that returns 503 until the schema matches; document the deploy order (push code → run migration → restart).
5. **Test database cleanup.** Live-DB tests now create users in addition to tasks. Need cleanup between runs (truncate or random-emailed throwaway users).

## Out of scope (revisit in Phase 2)

- OIDC / "Sign in with Google" / GitHub OAuth for user identity (Phase 2 picks an auth provider).
- Email verification.
- Password reset.
- User profile UI.
- Default-workstream seeding when a new user signs up.
- Org / team / shared-workspace support.
- Per-user rate limits (currently rate limits are IP-keyed).
