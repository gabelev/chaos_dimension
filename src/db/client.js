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

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  _pool = new Pool({ connectionString: url });
  _db = drizzle(_pool, { schema });
  return _db;
}
