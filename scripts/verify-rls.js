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

import { getDb } from '../src/db/client.js';
import { checkRlsState, RLS_REQUIRED_TABLES } from '../src/lib/rlsCheck.js';

// Standalone health check. Connects via getDb() — i.e. the runtime cd_app role
// (DATABASE_URL) — which is exactly the connection where the role-bypass check
// is meaningful (the migration runs as the table owner and skips that check).
// Run after any schema change (especially after `db:push`, which can silently
// disable RLS) to confirm the runtime role still enforces isolation.
//
//   npm run db:verify-rls          # whatever DATABASE_URL points at (test branch by default)
//   # against prod: set DATABASE_URL to the prod cd_app connection string, then run.

async function main() {
  const db = getDb();
  const problems = await checkRlsState(db);
  if (problems.length === 0) {
    console.log(`RLS state OK on all scoped tables (${RLS_REQUIRED_TABLES.join(', ')}).`);
    process.exit(0);
  }
  console.error('RLS state CHECK FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  console.error('Re-run `npm run db:migrate-multi-tenant` to restore the expected state.');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
