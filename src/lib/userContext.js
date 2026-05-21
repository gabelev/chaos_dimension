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
