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

import readline from 'node:readline';
import { sql } from 'drizzle-orm';
import { mintTokenLogic } from '../api/agent-tokens/index.js';
import { getMigrationDb } from '../src/db/client.js';

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => {
    rl.close();
    res(a);
  }));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--label' && argv[i + 1]) out.label = argv[i + 1];
  }
  return out;
}

async function main() {
  // Uses the migration (owner-role) connection — the same one
  // db:migrate-multi-tenant uses — not the runtime cd_app role. The cd_app
  // role is RLS-scoped and needs a per-request session var (app.current_user_id)
  // that a local script has no way to set, so its inserts into the RLS-forced
  // agents table would be rejected. The owner role bypasses RLS; we resolve the
  // owner's user id explicitly and stamp the token to it.
  const ownerEmail = process.env.CHAOS_OWNER_EMAIL;
  if (!ownerEmail) {
    console.error('\nCHAOS_OWNER_EMAIL is not set in .env.local. Set it to the owner account email and re-run.\n');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  console.log('\nMint a new MCP API token for Chaos Dimension.');
  console.log(`(Local script — no password required. Possession of the DB connection is the credential.)`);
  console.log(`Minting on the board of ${ownerEmail}.\n`);

  const label = args.label || (await prompt('Token label (e.g. "macbook"): ')).trim();
  if (!label) {
    console.error('Label is required.');
    process.exit(1);
  }

  const db = getMigrationDb();
  const ownerRows = await db.execute(sql`SELECT id FROM users WHERE email = ${ownerEmail} LIMIT 1`);
  const userId = (ownerRows.rows ?? ownerRows)[0]?.id;
  if (!userId) {
    console.error(`\nNo user found for CHAOS_OWNER_EMAIL=${ownerEmail}. Run db:migrate-multi-tenant first.\n`);
    process.exit(1);
  }

  const result = await mintTokenLogic({ db, body: { label }, userId });
  if (result.status !== 201) {
    console.error('\nMint failed:', result.body, '\n');
    process.exit(1);
  }

  console.log('\nMCP API key minted. Add this block to ~/.claude/.mcp.json under mcpServers:\n');
  console.log(JSON.stringify({
    'chaos-dimension': {
      url: 'https://www.chaosdimension.fyi/api/mcp',
      headers: { Authorization: `Bearer ${result.body.token}` },
    },
  }, null, 2));
  console.log('\nThis token is shown ONCE. Copy it now.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
