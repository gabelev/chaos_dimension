// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { getDb } from '../src/db/client.js';
import { workstreams } from '../src/db/schema.js';
import { WORKSTREAMS } from '../src/data/workstreams.js';

const db = getDb();

const rows = Object.entries(WORKSTREAMS).map(([id, w]) => ({
  id,
  label: w.label,
  color: w.color,
  icon: w.icon,
}));

await db.insert(workstreams).values(rows).onConflictDoNothing();
console.log(`Seeded ${rows.length} workstreams (idempotent).`);
process.exit(0);
