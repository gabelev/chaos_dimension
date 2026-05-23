import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';

// We use the WebSocket-backed Pool driver (not neon-http) because Phase 1
// multi-tenant scoping relies on interactive transactions: each request opens
// a tx, SET LOCAL app.current_user_id, then runs queries that read that
// session var via RLS policies. The HTTP driver only supports non-interactive
// batched transactions, which can't model `SET LOCAL → run query → use result`.

let _db = null;
let _pool = null;
let _migrationDb = null;
let _migrationPool = null;

// Under vitest, every DB connection must target the Neon test branch, never
// prod. Resolve the app/migration URLs accordingly. If VITEST is set but the
// TEST_* var is missing, throw — a misconfigured test run must FAIL, never
// silently fall through to the production database.
function appUrl() {
  if (process.env.VITEST) {
    const t = process.env.TEST_DATABASE_URL;
    if (!t) throw new Error('VITEST is set but TEST_DATABASE_URL is not — refusing to run tests against a non-test database');
    return t;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return url;
}

function migrationUrl() {
  if (process.env.VITEST) {
    const t = process.env.TEST_DATABASE_URL_MIGRATIONS || process.env.TEST_DATABASE_URL;
    if (!t) throw new Error('VITEST is set but TEST_DATABASE_URL_MIGRATIONS is not — refusing to run migration tests against a non-test database');
    return t;
  }
  // Local dev scripts (mint-invite, migrate-multi-tenant, list-waitlist, etc.)
  // prefer the test branch by default so a routine `npm run …` can't touch
  // prod. To target prod explicitly, unset TEST_DATABASE_URL_MIGRATIONS for
  // that command, e.g.:
  //   TEST_DATABASE_URL_MIGRATIONS= npm run mint-invite -- --note "real"
  const url = process.env.TEST_DATABASE_URL_MIGRATIONS
    || process.env.DATABASE_URL_MIGRATIONS
    || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MIGRATIONS / DATABASE_URL not set');
  return url;
}

// App connection. Uses the cd_app role (NOBYPASSRLS) so RLS policies actually
// enforce per-user isolation. Targets the test branch under vitest.
export function getDb() {
  if (_db) return _db;
  _pool = new Pool({ connectionString: appUrl() });
  _db = drizzle(_pool, { schema });
  return _db;
}

// Migration / DDL connection. The cd_app role has only DML privileges and
// cannot ALTER TABLE / CREATE POLICY, so the migration script connects as the
// owner role. Falls back to DATABASE_URL when the two-role split isn't
// configured (e.g. a fresh self-host before role setup). Targets the test
// branch under vitest.
export function getMigrationDb() {
  if (_migrationDb) return _migrationDb;
  _migrationPool = new Pool({ connectionString: migrationUrl() });
  _migrationDb = drizzle(_migrationPool, { schema });
  return _migrationDb;
}
