import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import readline from 'node:readline';
import { mintTokenLogic } from '../api/agent-tokens/index.js';
import { getDb } from '../src/db/client.js';

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
  if (!process.env.DATABASE_URL) {
    console.error('\nDATABASE_URL is not set in .env.local. Add it (copy from Vercel or Neon) and re-run.\n');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  console.log('\nMint a new MCP API token for Chaos Dimension.');
  console.log('(Local script — no password required. Possession of DATABASE_URL is the credential.)\n');

  const label = args.label || (await prompt('Token label (e.g. "macbook"): ')).trim();
  if (!label) {
    console.error('Label is required.');
    process.exit(1);
  }

  const db = getDb();
  const result = await mintTokenLogic({ db, body: { label } });
  if (result.status !== 201) {
    console.error('\nMint failed:', result.body, '\n');
    process.exit(1);
  }

  console.log('\nMCP API key minted. Add this block to ~/.claude/.mcp.json under mcpServers:\n');
  console.log(JSON.stringify({
    'chaos-dimension': {
      url: 'https://chaosdimension.fyi/api/mcp',
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
