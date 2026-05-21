import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/client.js';
import { users } from '../src/db/schema.js';
import { verifyPassword } from '../src/lib/passwords.js';
import { getSession } from '../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../src/lib/apiHandler.js';

async function defaultLookupOwner(email) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function handleLogin(req, res, ctx = {}) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'password required', message: 'Password is required.' });
  }
  const ok = await verifyPassword(password, process.env.CHAOS_PASSWORD_HASH);
  if (!ok) {
    return res.status(401).json({ error: 'invalid password', message: 'Invalid password.' });
  }

  const lookup = ctx.lookupOwner ?? defaultLookupOwner;
  const ownerEmail = process.env.CHAOS_OWNER_EMAIL;
  if (!ownerEmail) {
    return res.status(500).json({ error: 'CHAOS_OWNER_EMAIL not configured' });
  }
  const owner = await lookup(ownerEmail);
  if (!owner) {
    return res.status(500).json({ error: 'owner row missing, run db:migrate-multi-tenant' });
  }

  const session = await getSession(req, res);
  session.authed = true;
  session.userId = owner.id;
  session.iat = Date.now();
  await session.save();
  return res.status(200).json({ ok: true, userId: owner.id });
}

export default withErrors(handleLogin);
