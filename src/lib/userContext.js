// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
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

// Public-ledger read context. Sets app.public_read LOCAL to the transaction;
// the *_public_read RLS policies (scripts/migrate-multi-tenant.js) only grant
// SELECT on rows of public workstreams when this var is 'true'. It is a
// separate var — NOT a magic app.current_user_id value — so authenticated
// requests, which never set it, keep seeing exactly their own rows and
// nothing else. No user id is set, so writes fail every policy's WITH CHECK.
export async function withPublicContext(db, fn) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.public_read', 'true', true)`);
    return fn(tx);
  });
}
