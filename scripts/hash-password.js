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
