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

import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getMigrationDb } from '../src/db/client.js';

function parseArgs(argv) {
  const args = { note: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--note' && i + 1 < argv.length) {
      args.note = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function generateCode() {
  // 12 bytes → 16 base64url chars. ~96 bits entropy.
  return `cd_inv_${randomBytes(12).toString('base64url')}`;
}

export async function mintInvite({ note }) {
  const email = process.env.CHAOS_OWNER_EMAIL;
  if (!email) throw new Error('CHAOS_OWNER_EMAIL must be set');

  const db = getMigrationDb();
  const owner = await db.execute(sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`);
  const ownerId = (owner.rows ?? owner)[0]?.id;
  if (!ownerId) {
    throw new Error(`owner row not found for ${email} — run db:migrate-multi-tenant`);
  }

  const code = generateCode();
  await db.execute(sql`
    INSERT INTO invite_codes (id, code, created_by_id, note)
    VALUES (${createId()}, ${code}, ${ownerId}, ${note ?? ''})
  `);
  return { code, note: note ?? '' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  mintInvite(args)
    .then(({ code, note }) => {
      const baseUrl =
        process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') ||
        'https://www.chaosdimension.fyi';
      const link = `${baseUrl}/signup?invite=${encodeURIComponent(code)}`;
      // Single source of truth — token shown once.
      console.log('');
      console.log('Invite code minted:');
      console.log('');
      console.log(`  code: ${code}`);
      console.log(`  link: ${link}`);
      console.log('');
      if (note) console.log(`  note: ${note}`);
      console.log('  share the link (or code) with the recipient; the link pre-fills the form');
      console.log('');
      process.exit(0);
    })
    .catch((e) => {
      console.error('mint-invite failed:', e.message);
      process.exit(1);
    });
}
