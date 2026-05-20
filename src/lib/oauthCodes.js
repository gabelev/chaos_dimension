import { eq, and, isNull } from 'drizzle-orm';
import { oauthAuthCodes } from '../db/schema.js';
import { generateOauthToken, hashToken, PREFIX_CODE } from './oauthCrypto.js';

const CODE_TTL_MS = 60_000;

export async function issueAuthCode(db, { clientId, redirectUri, codeChallenge, codeChallengeMethod, scope, state }) {
  const code = generateOauthToken(PREFIX_CODE);
  const [row] = await db
    .insert(oauthAuthCodes)
    .values({
      codeHash: hashToken(code),
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope,
      state,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      consumedAt: null,
    })
    .returning();
  return { code, row };
}

export async function consumeAuthCode(db, code) {
  const rows = await db
    .select()
    .from(oauthAuthCodes)
    .where(eq(oauthAuthCodes.codeHash, hashToken(code)))
    .limit(1);
  if (!rows.length) return { ok: false, reason: 'not_found' };
  const row = rows[0];
  if (row.consumedAt) return { ok: false, reason: 'reuse', row };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired', row };
  // Conditional update closes the TOCTOU window between the select above and
  // the consume below: two concurrent callers race here, only one wins.
  const updated = await db
    .update(oauthAuthCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(oauthAuthCodes.id, row.id), isNull(oauthAuthCodes.consumedAt)))
    .returning();
  if (!updated?.length) return { ok: false, reason: 'reuse', row };
  return { ok: true, row };
}
