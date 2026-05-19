import 'dotenv/config';
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
