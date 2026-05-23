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
import { checkRlsState } from '../src/lib/rlsCheck.js';

// Standalone health check: runs the same assertion the migration's
// post-flight step runs, against whichever DATABASE_URL is configured.
// Run after any schema change (especially after `db:push`) to confirm
// RLS wasn't quietly turned off.
//
//   npm run db:verify-rls                           # current target (test branch by default)
//   TEST_DATABASE_URL_MIGRATIONS= npm run db:verify-rls   # against prod via DATABASE_URL_MIGRATIONS

async function main() {
  const db = getDb();
  const problems = await checkRlsState(db);
  if (problems.length === 0) {
    console.log('RLS state OK on all scoped tables (tasks, workstreams, agents, runs).');
    process.exit(0);
  }
  console.error('RLS state CHECK FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('');
  console.error('Re-run `npm run db:migrate-multi-tenant` to restore the expected state.');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
