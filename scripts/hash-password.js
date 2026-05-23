// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import readline from 'node:readline';
import { hashPassword } from '../src/lib/passwords.js';

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

const pw = await prompt('Password: ');
if (!pw || pw.length < 8) {
  console.error('Password must be at least 8 chars');
  process.exit(1);
}
const hash = await hashPassword(pw);
console.log('\nSet this as CHAOS_PASSWORD_HASH in your Vercel env:\n');
console.log(hash);
console.log('\nAlso generate CHAOS_SESSION_SECRET with: openssl rand -hex 32\n');
