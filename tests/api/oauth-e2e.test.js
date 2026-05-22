import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';

// Load .env.local explicitly (vitest doesn't pick it up by default).
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

const SKIP_DB = !process.env.DATABASE_URL;
const describeMaybe = SKIP_DB ? describe.skip : describe;
import { authenticateBearer } from '../../src/lib/mcpAuth.js';
import { handleRegister } from '../../api/oauth/register.js';
import { handleAuthorize } from '../../api/oauth/authorize.js';
import { handlePending } from '../../api/oauth/authorize/pending.js';
import { handleDecision } from '../../api/oauth/authorize/decision.js';
import { handleToken } from '../../api/oauth/token.js';
import { oauthClients, users } from '../../src/db/schema.js';

const SESSION_SECRET = 'x'.repeat(32);
const REDIRECT = 'https://localhost:65000/cb';

function s256(s) { return createHash('sha256').update(s).digest('base64url'); }

describeMaybe('oauth end-to-end (live DB)', () => {
  let db, ownerId;
  beforeAll(async () => {
    db = getDb();
    const rows = await db.select().from(users).where(eq(users.email, process.env.CHAOS_OWNER_EMAIL)).limit(1);
    ownerId = rows[0]?.id;
    if (!ownerId) throw new Error('owner row missing — run npm run db:migrate-multi-tenant');
  });

  it('completes the full flow and authenticates an MCP request', async () => {
    // 1. Register
    const reg = await handleRegister({
      db,
      body: {
        client_name: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: 'none',
      },
      ip: '127.0.0.1',
    });
    expect(reg.status).toBe(201);
    const clientId = reg.body.client_id;

    // 2. /authorize -> consent redirect with signed req
    const verifier = randomBytes(32).toString('base64url');
    const challenge = s256(verifier);
    const az = await handleAuthorize({
      db,
      session: { authed: true, userId: ownerId },
      query: {
        client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
        code_challenge: challenge, code_challenge_method: 'S256', state: 'e2e', scope: 'mcp',
      },
      sessionSecret: SESSION_SECRET,
    });
    expect(az.status).toBe(302);
    const reqToken = new URL('http://x' + az.location).searchParams.get('req');
    expect(reqToken).toBeTruthy();

    // 3. /authorize/pending -> CSRF
    const pending = await handlePending({ session: { authed: true, userId: ownerId }, req: reqToken, sessionSecret: SESSION_SECRET });
    expect(pending.status).toBe(200);
    expect(pending.body.client_name).toMatch(/^e2e-/);

    // 4. /authorize/decision allow -> redirect with code
    const decision = await handleDecision({
      session: { authed: true, userId: ownerId },
      body: { csrf: pending.body.csrf, decision: 'allow' },
      db,
      sessionSecret: SESSION_SECRET,
    });
    expect(decision.status).toBe(200);
    const code = new URL(decision.body.redirect).searchParams.get('code');
    expect(code).toMatch(/^cd_oac_/);

    // 5. /token authorization_code -> access + refresh
    const tk = await handleToken({
      db,
      body: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code, code_verifier: verifier, redirect_uri: REDIRECT,
      },
    });
    expect(tk.status).toBe(200);
    expect(tk.body.access_token).toMatch(/^cd_oat_/);
    expect(tk.body.refresh_token).toMatch(/^cd_ort_/);

    // 6. authenticate /api/mcp request — should auto-provision a synthetic agent
    const who = await authenticateBearer({ headers: { authorization: `Bearer ${tk.body.access_token}` } });
    expect(who).not.toBeNull();
    expect(who.agentId).toBeTruthy();
    expect(who.agentName).toMatch(/^e2e-/);
    expect(who.userId).toBe(ownerId);

    // Verify the client row now has the agent linked.
    const [clientRow] = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
    expect(clientRow.agentId).toBe(who.agentId);

    // 7. refresh -> new pair
    const refreshed = await handleToken({
      db,
      body: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tk.body.refresh_token },
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).not.toBe(tk.body.access_token);
    expect(refreshed.body.refresh_token).not.toBe(tk.body.refresh_token);

    // 8. old refresh fails (reuse detection burns the chain)
    const reused = await handleToken({
      db,
      body: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tk.body.refresh_token },
    });
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe('invalid_grant');
  }, 30000);

  it('rejects an authorization code with the wrong PKCE verifier', async () => {
    const reg = await handleRegister({
      db,
      body: {
        client_name: `e2e-bad-pkce-${Date.now()}`,
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: 'none',
      },
      ip: '127.0.0.1',
    });
    const clientId = reg.body.client_id;
    const verifier = randomBytes(32).toString('base64url');
    const challenge = s256(verifier);
    const az = await handleAuthorize({
      db, session: { authed: true, userId: ownerId },
      query: {
        client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
        code_challenge: challenge, code_challenge_method: 'S256', state: 'st', scope: 'mcp',
      },
      sessionSecret: SESSION_SECRET,
    });
    const reqToken = new URL('http://x' + az.location).searchParams.get('req');
    const pending = await handlePending({ session: { authed: true, userId: ownerId }, req: reqToken, sessionSecret: SESSION_SECRET });
    const decision = await handleDecision({
      session: { authed: true, userId: ownerId }, body: { csrf: pending.body.csrf, decision: 'allow' }, db, sessionSecret: SESSION_SECRET,
    });
    const code = new URL(decision.body.redirect).searchParams.get('code');

    const bad = await handleToken({
      db,
      body: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code, code_verifier: 'wrong-verifier', redirect_uri: REDIRECT,
      },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('invalid_grant');
    expect(bad.body.reason).toBe('pkce');
  }, 30000);
});
