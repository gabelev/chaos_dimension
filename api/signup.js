import { sql, eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../src/db/client.js';
import { users, inviteCodes } from '../src/db/schema.js';
import { hashPassword } from '../src/lib/passwords.js';
import { seedDefaultWorkstreams } from '../src/lib/defaultWorkstreams.js';
import { checkRateLimit, ipBucket } from '../src/lib/oauthRateLimit.js';
import { getSession } from '../src/lib/requireAuth.js';
import { withErrors, methodNotAllowed } from '../src/lib/apiHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function validate(body) {
  if (!body || typeof body !== 'object') return 'body required';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const inviteCode = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';
  if (!email || !EMAIL_RE.test(email)) return 'valid email required';
  if (!password || password.length < MIN_PASSWORD) return `password must be at least ${MIN_PASSWORD} characters`;
  if (!inviteCode) return 'invite code required';
  return { email, password, inviteCode };
}

export async function handleSignup({ db, body, ip, session }) {
  const v = validate(body);
  if (typeof v === 'string') return { status: 400, body: { error: 'invalid', message: v } };
  const { email, password, inviteCode } = v;

  // Rate limit BEFORE any DB writes. ipBucket falls back to 'unknown' if
  // the request has no IP (e.g. local dev), which is fine — they get the
  // same per-bucket quota as any other 'unknown' caller.
  const rl = await checkRateLimit(db, {
    bucket: `signup:${ip}`,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!rl.allowed) {
    return { status: 429, body: { error: 'rate_limited', message: 'Too many signup attempts. Try again later.' } };
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Look up + claim the invite code atomically. The conditional
      //    UPDATE ... WHERE claimed_by_user_id IS NULL serves as the
      //    one-shot guard (same TOCTOU-safe pattern as consumeAuthCode).
      const codeRows = await tx
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, inviteCode))
        .limit(1);
      if (!codeRows.length) {
        return { error: 'invalid_invite', message: 'Invite code is not valid.' };
      }
      const codeRow = codeRows[0];
      if (codeRow.claimedAt) {
        return { error: 'invalid_invite', message: 'Invite code has already been used.' };
      }

      // 2. Insert the user. UNIQUE on email enforces no duplicate accounts.
      let userRow;
      try {
        const [u] = await tx
          .insert(users)
          .values({ email, name: email.split('@')[0], passwordHash })
          .returning();
        userRow = u;
      } catch (err) {
        if (String(err?.message || '').includes('users_email_unique')
            || String(err?.code) === '23505') {
          return { error: 'email_taken', message: 'An account with that email already exists.' };
        }
        throw err;
      }

      // 3. Claim the code (one-shot). If a concurrent signup grabbed it
      //    between our SELECT and this UPDATE, we get 0 rows back.
      const claimed = await tx
        .update(inviteCodes)
        .set({ claimedByUserId: userRow.id, claimedAt: new Date() })
        .where(and(eq(inviteCodes.id, codeRow.id), isNull(inviteCodes.claimedByUserId)))
        .returning();
      if (!claimed?.length) {
        // Race lost. Roll back the user insert by throwing — drizzle's
        // tx() rolls the whole transaction.
        throw new Error('invite code consumed by a concurrent signup');
      }

      // 4. Set the RLS session var to the new user's id so the workstream
      //    inserts pass WITH CHECK. set_config(..., true) = LOCAL to tx.
      await tx.execute(sql`SELECT set_config('app.current_user_id', ${userRow.id}, true)`);

      // 5. Seed the starter workstreams.
      await seedDefaultWorkstreams(tx, userRow.id);

      return { user: userRow };
    });

    if (result.error) {
      return { status: 400, body: { error: result.error, message: result.message } };
    }

    // 6. Set the session OUTSIDE the transaction (iron-session writes a
    //    cookie via Set-Cookie; no DB involvement).
    if (session) {
      session.authed = true;
      session.userId = result.user.id;
      session.iat = Date.now();
      await session.save();
    }

    return { status: 201, body: { ok: true, userId: result.user.id } };
  } catch (err) {
    if (err?.message === 'invite code consumed by a concurrent signup') {
      return { status: 409, body: { error: 'invalid_invite', message: 'Invite code has already been used.' } };
    }
    throw err;
  }
}

export const config = { runtime: 'nodejs' };

export default withErrors(async function handle(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const session = await getSession(req, res);
  const ip = ipBucket('', req).split(':')[1] || 'unknown';
  const out = await handleSignup({ db: getDb(), body: req.body, ip, session });
  return res.status(out.status).json(out.body);
});
