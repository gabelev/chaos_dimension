import { eq, and, isNull } from 'drizzle-orm';
import { oauthAccessTokens, oauthRefreshTokens } from '../db/schema.js';
import { generateOauthToken, hashToken, PREFIX_ACCESS, PREFIX_REFRESH } from './oauthCrypto.js';

const ACCESS_TTL_MS = 60 * 60 * 1000;            // 1h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export async function issueTokenPair(db, { clientId, scope }) {
  const access = generateOauthToken(PREFIX_ACCESS);
  const refresh = generateOauthToken(PREFIX_REFRESH);

  const [accessRow] = await db
    .insert(oauthAccessTokens)
    .values({
      tokenHash: hashToken(access),
      clientId,
      scope,
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    })
    .returning();

  await db
    .insert(oauthRefreshTokens)
    .values({
      tokenHash: hashToken(refresh),
      clientId,
      accessTokenId: accessRow.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    })
    .returning();

  return { access, refresh, accessTokenId: accessRow.id, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
}

export async function findActiveAccessToken(db, accessToken) {
  const rows = await db
    .select()
    .from(oauthAccessTokens)
    .where(and(
      eq(oauthAccessTokens.tokenHash, hashToken(accessToken)),
      isNull(oauthAccessTokens.revokedAt),
    ))
    .limit(1);
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, row.id)).catch(() => {});
  return row;
}

export async function rotateRefreshToken(db, refreshToken) {
  const rows = await db
    .select()
    .from(oauthRefreshTokens)
    .where(eq(oauthRefreshTokens.tokenHash, hashToken(refreshToken)))
    .limit(1);
  if (!rows.length) return { ok: false, reason: 'not_found' };
  const row = rows[0];
  if (row.revokedAt) {
    await revokeChain(db, row.clientId);
    return { ok: false, reason: 'reuse', clientId: row.clientId };
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // Conditional update closes the TOCTOU window: if two concurrent callers
  // both passed the revokedAt check above, only one wins the UPDATE. The
  // loser falls through to the reuse path and burns the entire token chain.
  const consumed = await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(oauthRefreshTokens.id, row.id), isNull(oauthRefreshTokens.revokedAt)))
    .returning();
  if (!consumed?.length) {
    await revokeChain(db, row.clientId);
    return { ok: false, reason: 'reuse', clientId: row.clientId };
  }
  if (row.accessTokenId) {
    await db.update(oauthAccessTokens).set({ revokedAt: new Date() }).where(eq(oauthAccessTokens.id, row.accessTokenId));
  }
  // v1 scope is locked to 'mcp'. If multi-scope arrives later, source from row.
  const next = await issueTokenPair(db, { clientId: row.clientId, scope: 'mcp' });
  return { ok: true, ...next, clientId: row.clientId };
}

export async function revokeChain(db, clientId) {
  const now = new Date();
  await db.update(oauthAccessTokens).set({ revokedAt: now }).where(and(
    eq(oauthAccessTokens.clientId, clientId),
    isNull(oauthAccessTokens.revokedAt),
  ));
  await db.update(oauthRefreshTokens).set({ revokedAt: now }).where(and(
    eq(oauthRefreshTokens.clientId, clientId),
    isNull(oauthRefreshTokens.revokedAt),
  ));
}
