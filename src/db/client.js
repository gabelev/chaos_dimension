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

// App connection. Uses DATABASE_URL, which points at the cd_app role
// (NOBYPASSRLS) so RLS policies actually enforce per-user isolation.
export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _pool = new Pool({ connectionString: url });
  _db = drizzle(_pool, { schema });
  return _db;
}

// Migration / DDL connection. The cd_app role has only DML privileges and
// cannot ALTER TABLE / CREATE POLICY, so the migration script connects as the
// owner role via DATABASE_URL_MIGRATIONS. Falls back to DATABASE_URL when the
// two-role split isn't configured (e.g. a fresh self-host before role setup).
export function getMigrationDb() {
  if (_migrationDb) return _migrationDb;
  const url = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MIGRATIONS / DATABASE_URL not set');
  _migrationPool = new Pool({ connectionString: url });
  _migrationDb = drizzle(_migrationPool, { schema });
  return _migrationDb;
}
