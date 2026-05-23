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
import { getMigrationDb } from '../src/db/client.js';

function trunc(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

async function main() {
  const db = getMigrationDb();
  const r = await db.execute(sql`
    SELECT id, email, name, note, source, created_at
    FROM waitlist
    WHERE invited = false
    ORDER BY created_at DESC
  `);
  const rows = r.rows ?? r;
  if (!rows.length) {
    console.log('no pending waitlist entries.');
    return;
  }
  console.log('');
  console.log(`pending waitlist entries (${rows.length}):`);
  console.log('');
  for (const row of rows) {
    const when = new Date(row.created_at).toISOString().slice(0, 16).replace('T', ' ');
    console.log(`  ${when}  ${row.email}${row.name ? `  [${row.name}]` : ''}`);
    if (row.note) console.log(`    note: ${trunc(row.note, 200)}`);
    if (row.source) console.log(`    source: ${trunc(row.source, 80)}`);
    console.log(`    id: ${row.id}`);
    console.log('');
  }
  console.log('to invite one: npm run mint-invite -- --note "for <email>"');
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
