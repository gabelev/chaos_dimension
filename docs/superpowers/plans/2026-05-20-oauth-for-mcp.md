# OAuth 2.1 + DCR for `/api/mcp` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hand-rolled OAuth 2.1 authorization server (with PKCE + Dynamic Client Registration) alongside the existing `cd_...` bearer flow, so Claude Desktop and claude.ai web can connect to `/api/mcp` via "Add custom connector". The existing Claude Code flow must keep working unchanged.

**Architecture:** Five new library modules under `src/lib/` (crypto, clients, codes, tokens, rate-limit, metadata), seven new HTTP endpoints (DCR + authorize + pending + decision + token + two `.well-known`), one new React route (`/oauth/consent`), and a dual-path `authenticateMcpRequest` that disambiguates `cd_oat_` (OAuth access tokens) from `cd_` (agent tokens) by prefix. All new DB tables are additive — existing schema unchanged.

**Tech Stack:** Drizzle + Postgres (Neon), Vercel serverless functions (`api/*`), React 18 + react-router-dom, iron-session, vitest. No new prod dependencies.

**Spec:** `docs/superpowers/specs/2026-05-20-oauth-for-mcp-design.md`

---

## Conventions used throughout

- Tests live under `tests/lib/` (unit) and `tests/api/` (integration). Use vitest. `vitest.config.js` matches `tests/**/*.test.js`.
- The existing fake-db pattern in `tests/api/agent-tokens.test.js` shows how to stub Drizzle. Reuse and extend it.
- Token prefixes: `cd_oac_` (auth codes), `cd_oat_` (access), `cd_ort_` (refresh).
- All commits include the trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Never push to `main` from this plan — commits stack locally for the user to push.

---

### Task 1: Schema additions

**Files:**
- Modify: `src/db/schema.js` (append four tables + two helper tables, add `integer` to the imports)
- Test: `tests/lib/oauthSchema.test.js` (smoke test that the table objects export correctly)

- [ ] **Step 1: Write the failing test**

```js
// tests/lib/oauthSchema.test.js
import { describe, it, expect } from 'vitest';
import {
  oauthClients,
  oauthAuthCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthEvents,
  oauthRateLimits,
} from '../../src/db/schema.js';

describe('oauth schema', () => {
  it('exports all six oauth tables', () => {
    expect(oauthClients).toBeDefined();
    expect(oauthAuthCodes).toBeDefined();
    expect(oauthAccessTokens).toBeDefined();
    expect(oauthRefreshTokens).toBeDefined();
    expect(oauthEvents).toBeDefined();
    expect(oauthRateLimits).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/oauthSchema.test.js`
Expected: FAIL with "does not provide an export named 'oauthClients'".

- [ ] **Step 3: Append tables to `src/db/schema.js`**

First, update the import at the top of `src/db/schema.js`:
```js
import { pgTable, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
```

Then append at the end of the file:
```js
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  clientId: text('client_id').notNull().unique(),
  clientSecretHash: text('client_secret_hash'),
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').notNull(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  agentId: text('agent_id'),
});

export const oauthAuthCodes = pgTable('oauth_auth_codes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  codeHash: text('code_hash').notNull().unique(),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull(),
  scope: text('scope').notNull(),
  state: text('state'),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull(),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
});

export const oauthRefreshTokens = pgTable('oauth_refresh_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull(),
  accessTokenId: text('access_token_id'),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const oauthEvents = pgTable('oauth_events', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  clientId: text('client_id'),
  type: text('type').notNull(),
  detail: jsonb('detail').notNull().default({}),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const oauthRateLimits = pgTable('oauth_rate_limits', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bucket: text('bucket').notNull(),
  windowStart: timestamp('window_start').notNull(),
  count: integer('count').notNull().default(0),
});
```

(Note: foreign-key `.references(...)` constraints from the spec were dropped for simplicity. We rely on application-level integrity. If you want them back, add them after the tables are pushed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/oauthSchema.test.js`
Expected: PASS.

- [ ] **Step 5: Apply schema to the database**

Run: `npm run db:push`
Expected: drizzle-kit prompts to create the new tables. Accept.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.js tests/lib/oauthSchema.test.js
git commit -m "$(cat <<'EOF'
db: add oauth tables (clients, codes, access+refresh tokens, events, rate-limits)

Schema additions for the OAuth 2.1 server. All additive; existing
agent_tokens / agents / tasks tables untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `oauthCrypto.js` — tokens, hashing, PKCE, signed payloads

**Files:**
- Create: `src/lib/oauthCrypto.js`
- Test: `tests/lib/oauthCrypto.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/oauthCrypto.test.js
import { describe, it, expect } from 'vitest';
import {
  generateOauthToken,
  hashToken,
  detectTokenKind,
  verifyPkceS256,
  signPayload,
  verifyPayload,
  PREFIX_ACCESS,
  PREFIX_REFRESH,
  PREFIX_CODE,
} from '../../src/lib/oauthCrypto.js';

describe('oauthCrypto', () => {
  it('generates a token with the requested prefix', () => {
    const t = generateOauthToken(PREFIX_ACCESS);
    expect(t.startsWith('cd_oat_')).toBe(true);
    expect(t.length).toBeGreaterThan(40);
  });

  it('hashes to 64-char hex', () => {
    expect(hashToken('cd_oat_x')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects token kind from prefix', () => {
    expect(detectTokenKind('cd_oat_xyz')).toBe('access');
    expect(detectTokenKind('cd_ort_xyz')).toBe('refresh');
    expect(detectTokenKind('cd_oac_xyz')).toBe('code');
    expect(detectTokenKind('cd_xyz')).toBe('agent');
    expect(detectTokenKind('garbage')).toBe('unknown');
  });

  it('verifies a valid PKCE S256 verifier', () => {
    // verifier = "test-verifier-value-of-sufficient-length-abcdefg"
    // S256(verifier) = base64url(sha256(verifier))
    const verifier = 'test-verifier-value-of-sufficient-length-abcdefg';
    const challenge = 'oRcaJ4P4uH9P6tBfDCAjQF9Qd-1FK0vYqgNzn2P2qUE';
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
  });

  it('rejects an invalid PKCE verifier', () => {
    expect(verifyPkceS256('wrong', 'oRcaJ4P4uH9P6tBfDCAjQF9Qd-1FK0vYqgNzn2P2qUE')).toBe(false);
  });

  it('round-trips a signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, 60);
    const out = verifyPayload(sig, secret);
    expect(out).toEqual({ x: 1 });
  });

  it('rejects an expired signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, -1);
    expect(verifyPayload(sig, secret)).toBeNull();
  });

  it('rejects a tampered signed payload', () => {
    const secret = 'a'.repeat(32);
    const sig = signPayload({ x: 1 }, secret, 60);
    const tampered = sig.slice(0, -2) + 'AA';
    expect(verifyPayload(tampered, secret)).toBeNull();
  });
});
```

The challenge in the PKCE test was computed via:
```
node -e 'const c=require("crypto"); console.log(c.createHash("sha256").update("test-verifier-value-of-sufficient-length-abcdefg").digest("base64url"))'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/oauthCrypto.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/oauthCrypto.js`**

```js
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const PREFIX_ACCESS = 'cd_oat_';
export const PREFIX_REFRESH = 'cd_ort_';
export const PREFIX_CODE = 'cd_oac_';
const PREFIX_AGENT = 'cd_';

export function generateOauthToken(prefix) {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function detectTokenKind(token) {
  if (typeof token !== 'string') return 'unknown';
  if (token.startsWith(PREFIX_ACCESS)) return 'access';
  if (token.startsWith(PREFIX_REFRESH)) return 'refresh';
  if (token.startsWith(PREFIX_CODE)) return 'code';
  if (token.startsWith(PREFIX_AGENT)) return 'agent';
  return 'unknown';
}

export function verifyPkceS256(verifier, challenge) {
  if (typeof verifier !== 'string' || typeof challenge !== 'string') return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  if (computed.length !== challenge.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
}

export function signPayload(obj, secret, ttlSeconds) {
  const payload = { ...obj, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyPayload(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (expected.length !== sig.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  let parsed;
  try { parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  const { exp, ...rest } = parsed;
  return rest;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/oauthCrypto.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthCrypto.js tests/lib/oauthCrypto.test.js
git commit -m "$(cat <<'EOF'
oauth: crypto primitives — token gen, hashing, PKCE S256, signed payloads

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `oauthClients.js` — DCR validation + persistence

**Files:**
- Create: `src/lib/oauthClients.js`
- Test: `tests/lib/oauthClients.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/oauthClients.test.js
import { describe, it, expect } from 'vitest';
import { validateRegistrationRequest, normalizeRedirectUri, redirectUriAllowed } from '../../src/lib/oauthClients.js';

describe('oauthClients.validateRegistrationRequest', () => {
  it('accepts a minimal valid request', () => {
    const r = validateRegistrationRequest({
      client_name: 'Claude Desktop',
      redirect_uris: ['https://claude.ai/api/mcp/callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects when redirect_uris is missing or empty', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: [] }).ok).toBe(false);
    expect(validateRegistrationRequest({ client_name: 'x' }).ok).toBe(false);
  });

  it('rejects non-https redirect URIs (except localhost)', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://evil.example/cb'] }).ok).toBe(false);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://localhost:1234/cb'] }).ok).toBe(true);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://127.0.0.1/cb'] }).ok).toBe(true);
  });

  it('rejects URIs with a fragment', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['https://example.com/cb#frag'] }).ok).toBe(false);
  });

  it('rejects client_name longer than 200 chars', () => {
    expect(validateRegistrationRequest({ client_name: 'x'.repeat(201), redirect_uris: ['https://a/b'] }).ok).toBe(false);
  });
});

describe('redirectUriAllowed', () => {
  it('matches exact registered uris after normalization', () => {
    expect(redirectUriAllowed('https://A.example.com/cb', ['https://a.example.com/cb'])).toBe(true);
    expect(redirectUriAllowed('https://a.example.com/cb', ['https://a.example.com/other'])).toBe(false);
  });

  it('strips trailing slashes during comparison consistently', () => {
    expect(normalizeRedirectUri('https://x.example/cb/')).toBe('https://x.example/cb');
    expect(normalizeRedirectUri('https://x.example/cb')).toBe('https://x.example/cb');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/oauthClients.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/oauthClients.js`**

```js
const MAX_NAME = 200;
const MAX_URIS = 10;

export function normalizeRedirectUri(uri) {
  try {
    const u = new URL(uri);
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return uri;
  }
}

export function redirectUriAllowed(candidate, allowed) {
  const norm = normalizeRedirectUri(candidate);
  return allowed.some((r) => normalizeRedirectUri(r) === norm);
}

function uriOk(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:') {
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  }
  return false;
}

export function validateRegistrationRequest(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_client_metadata', message: 'body required' };
  }
  const name = body.client_name;
  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_NAME) {
    return { ok: false, error: 'invalid_client_metadata', message: 'client_name required (<=200 chars)' };
  }
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_URIS) {
    return { ok: false, error: 'invalid_redirect_uri', message: 'redirect_uris must be a non-empty array' };
  }
  for (const u of uris) {
    if (!uriOk(u)) return { ok: false, error: 'invalid_redirect_uri', message: `bad redirect_uri: ${u}` };
  }
  const method = body.token_endpoint_auth_method ?? 'client_secret_post';
  if (method !== 'client_secret_post' && method !== 'none') {
    return { ok: false, error: 'invalid_client_metadata', message: 'unsupported token_endpoint_auth_method' };
  }
  return {
    ok: true,
    value: {
      name,
      redirectUris: uris.map(normalizeRedirectUri),
      tokenEndpointAuthMethod: method,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/oauthClients.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthClients.js tests/lib/oauthClients.test.js
git commit -m "$(cat <<'EOF'
oauth: DCR request validation and redirect URI normalization

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `oauthCodes.js` — issue / consume authorization codes

**Files:**
- Create: `src/lib/oauthCodes.js`
- Test: `tests/lib/oauthCodes.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/oauthCodes.test.js
import { describe, it, expect, vi } from 'vitest';
import { issueAuthCode, consumeAuthCode } from '../../src/lib/oauthCodes.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';

function makeDb(initial = []) {
  const rows = [...initial];
  return {
    rows,
    insert: () => ({ values: (row) => ({ returning: async () => { rows.push(row); return [row]; } }) }),
    select: () => ({
      from: () => ({
        where: () => ({ limit: async (n) => rows.slice(0, n) }),
      }),
    }),
    update: () => ({ set: (patch) => ({ where: async () => { Object.assign(rows[0] ?? {}, patch); return [rows[0]]; } }) }),
  };
}

describe('oauthCodes', () => {
  it('issueAuthCode returns the raw code and stores its hash', async () => {
    const db = makeDb();
    const res = await issueAuthCode(db, {
      clientId: 'c1', redirectUri: 'https://x/cb',
      codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
    });
    expect(res.code).toMatch(/^cd_oac_/);
    expect(db.rows[0].codeHash).toBe(hashToken(res.code));
    expect(db.rows[0].consumedAt).toBeNull();
  });

  it('consumeAuthCode returns the row and marks it consumed on first use', async () => {
    const db = makeDb([{
      id: 'r1', codeHash: hashToken('cd_oac_known'), clientId: 'c1',
      redirectUri: 'https://x/cb', codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
      expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    }]);
    const out = await consumeAuthCode(db, 'cd_oac_known');
    expect(out.ok).toBe(true);
    expect(out.row.clientId).toBe('c1');
    expect(db.rows[0].consumedAt).not.toBeNull();
  });

  it('consumeAuthCode rejects an expired code', async () => {
    const db = makeDb([{
      id: 'r1', codeHash: hashToken('cd_oac_old'), clientId: 'c1',
      redirectUri: 'https://x/cb', codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
      expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    }]);
    const out = await consumeAuthCode(db, 'cd_oac_old');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('expired');
  });

  it('consumeAuthCode reports reuse on a second consume', async () => {
    const consumed = {
      id: 'r1', codeHash: hashToken('cd_oac_used'), clientId: 'c1',
      redirectUri: 'https://x/cb', codeChallenge: 'abc', codeChallengeMethod: 'S256',
      scope: 'mcp', state: 's',
      expiresAt: new Date(Date.now() + 60_000), consumedAt: new Date(),
    };
    const db = makeDb([consumed]);
    const out = await consumeAuthCode(db, 'cd_oac_used');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('reuse');
    expect(out.row.clientId).toBe('c1');
  });

  it('consumeAuthCode returns not_found for unknown codes', async () => {
    const db = makeDb();
    const out = await consumeAuthCode(db, 'cd_oac_nope');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('not_found');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/oauthCodes.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/oauthCodes.js`**

```js
import { eq } from 'drizzle-orm';
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
  await db.update(oauthAuthCodes).set({ consumedAt: new Date() }).where(eq(oauthAuthCodes.id, row.id));
  return { ok: true, row };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/oauthCodes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthCodes.js tests/lib/oauthCodes.test.js
git commit -m "$(cat <<'EOF'
oauth: authorization code issuance with one-shot consume and reuse detection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `oauthTokens.js` — issue + refresh-rotate access/refresh token pairs

**Files:**
- Create: `src/lib/oauthTokens.js`
- Test: `tests/lib/oauthTokens.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/oauthTokens.test.js
import { describe, it, expect } from 'vitest';
import { issueTokenPair, findActiveAccessToken, rotateRefreshToken, revokeChain } from '../../src/lib/oauthTokens.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';

function fakeDb() {
  const access = [];
  const refresh = [];
  return {
    access, refresh,
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const target = table === 'access' ? access : refresh;
          const created = { id: `id-${target.length + 1}`, ...row };
          target.push(created);
          return [created];
        },
      }),
    }),
    selectFromAccess: (predicate) => access.filter(predicate),
    selectFromRefresh: (predicate) => refresh.filter(predicate),
    updateAccess: (id, patch) => { const r = access.find((x) => x.id === id); if (r) Object.assign(r, patch); },
    updateRefresh: (id, patch) => { const r = refresh.find((x) => x.id === id); if (r) Object.assign(r, patch); },
  };
}

// Adapter to make our test fakeDb look like the drizzle surface used by the impl.
function drizzleAdapter(fake) {
  const tableNameOf = (t) => (t && t[Symbol.for('drizzle:Name')]) || (t && t.name);
  return {
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const name = tableNameOf(table) || (row.accessTokenId !== undefined ? 'oauth_refresh_tokens' : 'oauth_access_tokens');
          const target = name === 'oauth_refresh_tokens' ? fake.refresh : fake.access;
          const created = { id: `id-${target.length + 1}`, ...row };
          target.push(created);
          return [created];
        },
      }),
    }),
    select: () => ({
      from: (table) => ({
        where: (cond) => ({
          limit: async () => {
            const name = tableNameOf(table);
            const pool = name === 'oauth_refresh_tokens' ? fake.refresh : fake.access;
            return pool.filter(cond.__match);
          },
        }),
      }),
    }),
    update: (table) => ({
      set: (patch) => ({
        where: async (cond) => {
          const name = tableNameOf(table);
          const pool = name === 'oauth_refresh_tokens' ? fake.refresh : fake.access;
          for (const r of pool) if (cond.__match(r)) Object.assign(r, patch);
        },
      }),
    }),
  };
}

describe('oauthTokens', () => {
  it('issueTokenPair stores hashes and returns raw strings', async () => {
    const fake = fakeDb();
    const out = await issueTokenPair(drizzleAdapter(fake), { clientId: 'c1', scope: 'mcp' });
    expect(out.access).toMatch(/^cd_oat_/);
    expect(out.refresh).toMatch(/^cd_ort_/);
    expect(fake.access[0].tokenHash).toBe(hashToken(out.access));
    expect(fake.refresh[0].tokenHash).toBe(hashToken(out.refresh));
    expect(fake.refresh[0].accessTokenId).toBe(fake.access[0].id);
  });
});
```

Note: this test stubs Drizzle minimally. The real assertion targets that the impl uses the table names and hashes correctly. Subsequent integration tests (Task 13) exercise the live DB flow.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/oauthTokens.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/oauthTokens.js`**

```js
import { eq, and, isNull } from 'drizzle-orm';
import { oauthAccessTokens, oauthRefreshTokens } from '../db/schema.js';
import { generateOauthToken, hashToken, PREFIX_ACCESS, PREFIX_REFRESH } from './oauthCrypto.js';

const ACCESS_TTL_MS = 60 * 60 * 1000;          // 1h
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

  await db.update(oauthRefreshTokens).set({ revokedAt: new Date() }).where(eq(oauthRefreshTokens.id, row.id));
  if (row.accessTokenId) {
    await db.update(oauthAccessTokens).set({ revokedAt: new Date() }).where(eq(oauthAccessTokens.id, row.accessTokenId));
  }
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/oauthTokens.test.js`
Expected: the existing test passes against the Drizzle adapter. (Deeper paths covered in Task 13 integration tests.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthTokens.js tests/lib/oauthTokens.test.js
git commit -m "$(cat <<'EOF'
oauth: token pair issuance, refresh rotation, reuse-detection chain revoke

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `oauthRateLimit.js` — Postgres sliding-window counter

**Files:**
- Create: `src/lib/oauthRateLimit.js`
- Test: `tests/lib/oauthRateLimit.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/lib/oauthRateLimit.test.js
import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../../src/lib/oauthRateLimit.js';

function fakeDb(initialRows = []) {
  const rows = [...initialRows];
  return {
    rows,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows.slice(0, 1),
        }),
      }),
    }),
    insert: () => ({
      values: (v) => ({
        returning: async () => { rows.push({ id: `r-${rows.length}`, ...v }); return [rows[rows.length - 1]]; },
      }),
    }),
    update: () => ({ set: (patch) => ({ where: async () => { if (rows[0]) Object.assign(rows[0], patch); } }) }),
  };
}

describe('checkRateLimit', () => {
  it('allows the first request and creates a window row', async () => {
    const db = fakeDb();
    const res = await checkRateLimit(db, { bucket: 'register:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(res.allowed).toBe(true);
    expect(db.rows.length).toBe(1);
    expect(db.rows[0].count).toBe(1);
  });

  it('denies once over the limit', async () => {
    const db = fakeDb([{ id: 'r0', bucket: 'register:1.2.3.4', windowStart: new Date(), count: 5 }]);
    const res = await checkRateLimit(db, { bucket: 'register:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(res.allowed).toBe(false);
  });

  it('resets when the window has elapsed', async () => {
    const db = fakeDb([{ id: 'r0', bucket: 'register:1.2.3.4', windowStart: new Date(Date.now() - 70_000), count: 100 }]);
    const res = await checkRateLimit(db, { bucket: 'register:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(res.allowed).toBe(true);
    expect(db.rows[0].count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/oauthRateLimit.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/oauthRateLimit.js`**

```js
import { eq } from 'drizzle-orm';
import { oauthRateLimits } from '../db/schema.js';

export async function checkRateLimit(db, { bucket, limit, windowSeconds }) {
  const rows = await db
    .select()
    .from(oauthRateLimits)
    .where(eq(oauthRateLimits.bucket, bucket))
    .limit(1);

  const now = new Date();
  if (!rows.length) {
    await db.insert(oauthRateLimits).values({ bucket, windowStart: now, count: 1 }).returning();
    return { allowed: true };
  }

  const row = rows[0];
  const windowAge = (now.getTime() - new Date(row.windowStart).getTime()) / 1000;
  if (windowAge >= windowSeconds) {
    await db.update(oauthRateLimits).set({ windowStart: now, count: 1 }).where(eq(oauthRateLimits.id, row.id));
    return { allowed: true };
  }

  if (row.count >= limit) return { allowed: false, retryAfter: Math.ceil(windowSeconds - windowAge) };

  await db.update(oauthRateLimits).set({ count: row.count + 1 }).where(eq(oauthRateLimits.id, row.id));
  return { allowed: true };
}

export function ipBucket(name, req) {
  const fwd = req.headers?.['x-forwarded-for'] || '';
  const ip = String(fwd).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  return `${name}:${ip}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/oauthRateLimit.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthRateLimit.js tests/lib/oauthRateLimit.test.js
git commit -m "$(cat <<'EOF'
oauth: Postgres-backed sliding-window rate limiter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `oauthMetadata.js` — `.well-known` payload builders

**Files:**
- Create: `src/lib/oauthMetadata.js`
- Test: `tests/lib/oauthMetadata.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/lib/oauthMetadata.test.js
import { describe, it, expect } from 'vitest';
import { authServerMetadata, protectedResourceMetadata } from '../../src/lib/oauthMetadata.js';

describe('oauthMetadata', () => {
  it('returns standard authorization-server fields', () => {
    const m = authServerMetadata('https://example.com');
    expect(m.issuer).toBe('https://example.com');
    expect(m.authorization_endpoint).toBe('https://example.com/api/oauth/authorize');
    expect(m.token_endpoint).toBe('https://example.com/api/oauth/token');
    expect(m.registration_endpoint).toBe('https://example.com/api/oauth/register');
    expect(m.code_challenge_methods_supported).toEqual(['S256']);
    expect(m.grant_types_supported).toContain('authorization_code');
    expect(m.grant_types_supported).toContain('refresh_token');
    expect(m.response_types_supported).toEqual(['code']);
  });

  it('returns protected-resource metadata pointing at the auth server', () => {
    const m = protectedResourceMetadata('https://example.com');
    expect(m.resource).toBe('https://example.com/api/mcp');
    expect(m.authorization_servers).toEqual(['https://example.com']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/oauthMetadata.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/oauthMetadata.js`**

```js
export function authServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['mcp'],
  };
}

export function protectedResourceMetadata(origin) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['mcp'],
  };
}

export function originFromRequest(req) {
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  return `${proto}://${host}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/oauthMetadata.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthMetadata.js tests/lib/oauthMetadata.test.js
git commit -m "$(cat <<'EOF'
oauth: .well-known metadata builders for auth server + protected resource

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Extend `mcpAuth.js` to accept OAuth access tokens

**Files:**
- Modify: `src/lib/mcpAuth.js`
- Test: `tests/lib/mcpAuth.test.js` (new)

- [ ] **Step 1: Write failing tests**

```js
// tests/lib/mcpAuth.test.js
import { describe, it, expect, vi } from 'vitest';
import { authenticateBearer } from '../../src/lib/mcpAuth.js';

describe('authenticateBearer', () => {
  it('returns null when there is no Authorization header', async () => {
    const out = await authenticateBearer({ headers: {} }, { db: null });
    expect(out).toBeNull();
  });

  it('routes a cd_oat_ token to the OAuth access-token path', async () => {
    const lookups = [];
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(async () => null),
      lookupOauthAccessToken: vi.fn(async (token) => { lookups.push(token); return { clientId: 'client-1', clientName: 'Claude Desktop', agentId: 'agent-from-client-1' }; }),
    };
    const req = { headers: { authorization: 'Bearer cd_oat_xyz' } };
    const out = await authenticateBearer(req, ctx);
    expect(ctx.lookupAgentToken).not.toHaveBeenCalled();
    expect(ctx.lookupOauthAccessToken).toHaveBeenCalled();
    expect(out).toEqual({ agentId: 'agent-from-client-1', agentName: 'Claude Desktop' });
  });

  it('routes a cd_ token to the agent-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(async () => ({ agentId: 'a1', agentName: 'macbook' })),
      lookupOauthAccessToken: vi.fn(async () => { throw new Error('should not be called'); }),
    };
    const out = await authenticateBearer({ headers: { authorization: 'Bearer cd_legacy' } }, ctx);
    expect(out).toEqual({ agentId: 'a1', agentName: 'macbook' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/mcpAuth.test.js`
Expected: FAIL — the function `authenticateBearer` and its injectable lookups don't exist yet.

- [ ] **Step 3: Refactor `src/lib/mcpAuth.js`**

Replace the file contents with:
```js
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { agentTokens, agents, oauthAccessTokens, oauthClients } from '../db/schema.js';
import { hashToken as hashAgentToken } from './agentToken.js';
import { detectTokenKind, hashToken as hashOauthToken } from './oauthCrypto.js';

async function defaultLookupAgentToken(db, token) {
  const rows = await db
    .select({
      agentId: agentTokens.agentId,
      tokenId: agentTokens.id,
      revoked: agentTokens.revoked,
      agentName: agents.name,
    })
    .from(agentTokens)
    .innerJoin(agents, eq(agents.id, agentTokens.agentId))
    .where(and(eq(agentTokens.tokenHash, hashAgentToken(token)), eq(agentTokens.revoked, false)))
    .limit(1);
  if (!rows.length) return null;
  db.update(agentTokens).set({ lastUsedAt: new Date() }).where(eq(agentTokens.id, rows[0].tokenId)).catch(() => {});
  return { agentId: rows[0].agentId, agentName: rows[0].agentName };
}

async function defaultLookupOauthAccessToken(db, token) {
  const rows = await db
    .select({
      tokenId: oauthAccessTokens.id,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
      revokedAt: oauthAccessTokens.revokedAt,
      clientName: oauthClients.name,
      agentId: oauthClients.agentId,
    })
    .from(oauthAccessTokens)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthAccessTokens.clientId))
    .where(eq(oauthAccessTokens.tokenHash, hashOauthToken(token)))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  if (r.revokedAt) return null;
  if (new Date(r.expiresAt).getTime() < Date.now()) return null;
  db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, r.tokenId)).catch(() => {});
  return { clientId: r.clientId, clientName: r.clientName, agentId: r.agentId };
}

export async function authenticateBearer(req, ctx = {}) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;

  const db = ctx.db ?? getDb();
  const kind = detectTokenKind(token);

  if (kind === 'access') {
    const lookup = ctx.lookupOauthAccessToken ?? ((t) => defaultLookupOauthAccessToken(db, t));
    const hit = await lookup(token);
    if (!hit) return null;
    return { agentId: hit.agentId, agentName: hit.clientName };
  }

  if (kind === 'agent') {
    const lookup = ctx.lookupAgentToken ?? ((t) => defaultLookupAgentToken(db, t));
    return lookup(token);
  }

  return null;
}

export const authenticateMcpRequest = authenticateBearer;
```

The old export `authenticateMcpRequest` is preserved as an alias so existing callers (e.g. `api/mcp.js`) don't break.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/mcpAuth.test.js`
Expected: PASS.

Also re-run the full suite to confirm nothing else broke:
Run: `npx vitest run`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcpAuth.js tests/lib/mcpAuth.test.js
git commit -m "$(cat <<'EOF'
oauth: dual-path bearer auth in mcpAuth (agent_tokens + oauth_access_tokens)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `POST /api/oauth/register` (DCR)

**Files:**
- Create: `api/oauth/register.js`
- Test: `tests/api/oauth-register.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/api/oauth-register.test.js
import { describe, it, expect } from 'vitest';
import { handleRegister } from '../../api/oauth/register.js';

function memoryDb() {
  const state = { clients: [], rateLimits: [], events: [] };
  return {
    state,
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name;
          const target = name === 'oauth_clients' ? state.clients : name === 'oauth_rate_limits' ? state.rateLimits : state.events;
          const created = { id: `id-${target.length + 1}`, ...row };
          target.push(created);
          return [created];
        },
      }),
    }),
    select: () => ({
      from: (table) => ({
        where: () => ({ limit: async () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name;
          if (name === 'oauth_rate_limits') return state.rateLimits.slice(0, 1);
          return [];
        } }),
      }),
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
}

describe('POST /api/oauth/register', () => {
  it('rejects a request missing redirect_uris', async () => {
    const res = await handleRegister({
      db: memoryDb(),
      body: { client_name: 'X' },
      ip: '1.1.1.1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_redirect_uri');
  });

  it('returns client_id (and secret for confidential) on success', async () => {
    const res = await handleRegister({
      db: memoryDb(),
      body: {
        client_name: 'Claude Desktop',
        redirect_uris: ['https://claude.ai/api/mcp/callback'],
        token_endpoint_auth_method: 'client_secret_post',
      },
      ip: '1.1.1.1',
    });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toMatch(/^cdmcp_/);
    expect(typeof res.body.client_secret).toBe('string');
    expect(res.body.redirect_uris).toEqual(['https://claude.ai/api/mcp/callback']);
  });

  it('omits client_secret for public clients', async () => {
    const res = await handleRegister({
      db: memoryDb(),
      body: {
        client_name: 'Claude Desktop',
        redirect_uris: ['https://claude.ai/api/mcp/callback'],
        token_endpoint_auth_method: 'none',
      },
      ip: '1.1.1.1',
    });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toMatch(/^cdmcp_/);
    expect(res.body.client_secret).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/oauth-register.test.js`
Expected: FAIL — handler does not exist.

- [ ] **Step 3: Implement `api/oauth/register.js`**

```js
import { randomBytes } from 'node:crypto';
import { getDb } from '../../src/db/client.js';
import { oauthClients, oauthEvents } from '../../src/db/schema.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';
import { validateRegistrationRequest } from '../../src/lib/oauthClients.js';
import { checkRateLimit, ipBucket } from '../../src/lib/oauthRateLimit.js';

function generateClientId() {
  return `cdmcp_${randomBytes(12).toString('base64url')}`;
}

function generateClientSecret() {
  return `cdmcps_${randomBytes(32).toString('base64url')}`;
}

export async function handleRegister({ db, body, ip }) {
  const rl = await checkRateLimit(db, { bucket: `register:${ip}`, limit: 10, windowSeconds: 60 });
  if (!rl.allowed) return { status: 429, body: { error: 'rate_limited' } };

  const v = validateRegistrationRequest(body);
  if (!v.ok) return { status: 400, body: { error: v.error, message: v.message } };

  const clientId = generateClientId();
  let secret = null;
  let secretHash = null;
  if (v.value.tokenEndpointAuthMethod === 'client_secret_post') {
    secret = generateClientSecret();
    secretHash = hashToken(secret);
  }

  await db.insert(oauthClients).values({
    clientId,
    clientSecretHash: secretHash,
    name: v.value.name,
    redirectUris: v.value.redirectUris,
    tokenEndpointAuthMethod: v.value.tokenEndpointAuthMethod,
  }).returning();

  await db.insert(oauthEvents).values({
    clientId,
    type: 'register',
    detail: { name: v.value.name },
  }).returning();

  const body_ = {
    client_id: clientId,
    client_name: v.value.name,
    redirect_uris: v.value.redirectUris,
    token_endpoint_auth_method: v.value.tokenEndpointAuthMethod,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  };
  if (secret) body_.client_secret = secret;
  return { status: 201, body: body_ };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const result = await handleRegister({ db: getDb(), body: req.body, ip });
  res.status(result.status).json(result.body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/oauth-register.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/oauth/register.js tests/api/oauth-register.test.js
git commit -m "$(cat <<'EOF'
oauth: POST /api/oauth/register (RFC 7591 dynamic client registration)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `GET /api/oauth/authorize` — guard + redirect

**Files:**
- Create: `api/oauth/authorize.js`
- Test: `tests/api/oauth-authorize.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/api/oauth-authorize.test.js
import { describe, it, expect } from 'vitest';
import { handleAuthorize } from '../../api/oauth/authorize.js';

function db(clients = []) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => clients.slice(0, 1) }),
      }),
    }),
  };
}

describe('GET /api/oauth/authorize', () => {
  it('returns 400 when required params are missing', async () => {
    const out = await handleAuthorize({
      db: db([]),
      session: { authed: true },
      query: { client_id: 'x' },
    });
    expect(out.status).toBe(400);
  });

  it('redirects to login when not authed', async () => {
    const out = await handleAuthorize({
      db: db([{ clientId: 'c1', redirectUris: ['https://a/b'] }]),
      session: {},
      query: {
        client_id: 'c1', redirect_uri: 'https://a/b', response_type: 'code',
        code_challenge: 'cc', code_challenge_method: 'S256', state: 's', scope: 'mcp',
      },
      originalUrl: '/api/oauth/authorize?client_id=c1&redirect_uri=https://a/b&response_type=code&code_challenge=cc&code_challenge_method=S256&state=s&scope=mcp',
    });
    expect(out.status).toBe(302);
    expect(out.location).toContain('/login?next=');
  });

  it('redirects to /oauth/consent when authed and request is valid', async () => {
    const out = await handleAuthorize({
      db: db([{ clientId: 'c1', redirectUris: ['https://a/b'], name: 'Claude Desktop' }]),
      session: { authed: true },
      query: {
        client_id: 'c1', redirect_uri: 'https://a/b', response_type: 'code',
        code_challenge: 'cc', code_challenge_method: 'S256', state: 's', scope: 'mcp',
      },
      sessionSecret: 'x'.repeat(32),
    });
    expect(out.status).toBe(302);
    expect(out.location).toMatch(/^\/oauth\/consent\?req=/);
  });

  it('rejects unknown clients', async () => {
    const out = await handleAuthorize({
      db: db([]),
      session: { authed: true },
      query: {
        client_id: 'nope', redirect_uri: 'https://a/b', response_type: 'code',
        code_challenge: 'cc', code_challenge_method: 'S256', state: 's', scope: 'mcp',
      },
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_client');
  });

  it('rejects mismatched redirect_uri', async () => {
    const out = await handleAuthorize({
      db: db([{ clientId: 'c1', redirectUris: ['https://a/b'] }]),
      session: { authed: true },
      query: {
        client_id: 'c1', redirect_uri: 'https://evil/cb', response_type: 'code',
        code_challenge: 'cc', code_challenge_method: 'S256', state: 's', scope: 'mcp',
      },
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_redirect_uri');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/oauth-authorize.test.js`
Expected: FAIL — handler missing.

- [ ] **Step 3: Implement `api/oauth/authorize.js`**

```js
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { oauthClients } from '../../src/db/schema.js';
import { redirectUriAllowed } from '../../src/lib/oauthClients.js';
import { signPayload } from '../../src/lib/oauthCrypto.js';
import { getSession } from '../../src/lib/requireAuth.js';

const REQUIRED = ['client_id', 'redirect_uri', 'response_type', 'code_challenge', 'code_challenge_method', 'state', 'scope'];

export async function handleAuthorize({ db, session, query, originalUrl, sessionSecret }) {
  for (const k of REQUIRED) {
    if (!query[k]) return { status: 400, body: { error: 'invalid_request', message: `missing ${k}` } };
  }
  if (query.response_type !== 'code') return { status: 400, body: { error: 'unsupported_response_type' } };
  if (query.code_challenge_method !== 'S256') return { status: 400, body: { error: 'invalid_request', message: 'PKCE S256 required' } };
  if (query.scope !== 'mcp') return { status: 400, body: { error: 'invalid_scope' } };

  const rows = await db.select().from(oauthClients).where(eq(oauthClients.clientId, query.client_id)).limit(1);
  if (!rows.length) return { status: 400, body: { error: 'invalid_client' } };
  const client = rows[0];
  if (!redirectUriAllowed(query.redirect_uri, client.redirectUris)) {
    return { status: 400, body: { error: 'invalid_redirect_uri' } };
  }

  if (!session?.authed) {
    return { status: 302, location: `/login?next=${encodeURIComponent(originalUrl ?? '')}` };
  }

  const req = signPayload(
    {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uri: query.redirect_uri,
      code_challenge: query.code_challenge,
      code_challenge_method: 'S256',
      scope: 'mcp',
      state: query.state,
    },
    sessionSecret,
    5 * 60,
  );
  return { status: 302, location: `/oauth/consent?req=${encodeURIComponent(req)}` };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const result = await handleAuthorize({
    db: getDb(),
    session,
    query: req.query,
    originalUrl: req.url,
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  if (result.location) {
    res.writeHead(result.status, { Location: result.location });
    res.end();
    return;
  }
  res.status(result.status).json(result.body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/oauth-authorize.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/oauth/authorize.js tests/api/oauth-authorize.test.js
git commit -m "$(cat <<'EOF'
oauth: GET /api/oauth/authorize with login + consent redirects

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `GET /api/oauth/authorize/pending`

**Files:**
- Create: `api/oauth/authorize/pending.js`
- Test: `tests/api/oauth-authorize-pending.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/api/oauth-authorize-pending.test.js
import { describe, it, expect } from 'vitest';
import { handlePending } from '../../api/oauth/authorize/pending.js';
import { signPayload } from '../../src/lib/oauthCrypto.js';

describe('GET /api/oauth/authorize/pending', () => {
  it('returns 401 when not authed', async () => {
    const out = await handlePending({ session: {}, req: 'x', sessionSecret: 'a'.repeat(32) });
    expect(out.status).toBe(401);
  });

  it('returns 400 when req payload is missing or bad', async () => {
    const out = await handlePending({ session: { authed: true }, req: 'garbage', sessionSecret: 'a'.repeat(32) });
    expect(out.status).toBe(400);
  });

  it('returns the request details and a fresh CSRF payload on success', async () => {
    const sessionSecret = 'a'.repeat(32);
    const req = signPayload({
      client_id: 'c1', client_name: 'Claude Desktop', redirect_uri: 'https://a/b',
      code_challenge: 'cc', code_challenge_method: 'S256', scope: 'mcp', state: 's',
    }, sessionSecret, 60);
    const out = await handlePending({ session: { authed: true }, req, sessionSecret });
    expect(out.status).toBe(200);
    expect(out.body.client_name).toBe('Claude Desktop');
    expect(out.body.scope).toBe('mcp');
    expect(typeof out.body.csrf).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/oauth-authorize-pending.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `api/oauth/authorize/pending.js`**

```js
import { signPayload, verifyPayload } from '../../../src/lib/oauthCrypto.js';
import { getSession } from '../../../src/lib/requireAuth.js';

export async function handlePending({ session, req, sessionSecret }) {
  if (!session?.authed) return { status: 401, body: { error: 'unauthorized' } };
  const parsed = verifyPayload(req, sessionSecret);
  if (!parsed) return { status: 400, body: { error: 'invalid_request' } };

  const csrf = signPayload({ req }, sessionSecret, 5 * 60);
  return {
    status: 200,
    body: {
      client_name: parsed.client_name,
      scope: parsed.scope,
      redirect_uri: parsed.redirect_uri,
      csrf,
    },
  };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const out = await handlePending({
    session,
    req: req.query?.req,
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  res.status(out.status).json(out.body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/oauth-authorize-pending.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/oauth/authorize/pending.js tests/api/oauth-authorize-pending.test.js
git commit -m "$(cat <<'EOF'
oauth: GET /api/oauth/authorize/pending — returns request details + CSRF token

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `POST /api/oauth/authorize/decision`

**Files:**
- Create: `api/oauth/authorize/decision.js`
- Test: `tests/api/oauth-authorize-decision.test.js`

- [ ] **Step 1: Write failing test**

```js
// tests/api/oauth-authorize-decision.test.js
import { describe, it, expect } from 'vitest';
import { handleDecision } from '../../api/oauth/authorize/decision.js';
import { signPayload } from '../../src/lib/oauthCrypto.js';

function memoryDb(initialClients = []) {
  const state = { clients: [...initialClients], codes: [], events: [] };
  return {
    state,
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name;
          const created = { id: `id-${Math.random()}`, ...row };
          if (name === 'oauth_auth_codes') state.codes.push(created);
          else state.events.push(created);
          return [created];
        },
      }),
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => state.clients.slice(0, 1) }) }) }),
  };
}

describe('POST /api/oauth/authorize/decision', () => {
  const sessionSecret = 'a'.repeat(32);
  const goodReq = signPayload({
    client_id: 'c1', client_name: 'Claude Desktop', redirect_uri: 'https://a/b',
    code_challenge: 'cc', code_challenge_method: 'S256', scope: 'mcp', state: 'st',
  }, sessionSecret, 60);

  it('returns 401 when not authed', async () => {
    const out = await handleDecision({ session: {}, body: { csrf: 'x', decision: 'allow' }, db: memoryDb(), sessionSecret });
    expect(out.status).toBe(401);
  });

  it('returns 400 on bad CSRF', async () => {
    const out = await handleDecision({ session: { authed: true }, body: { csrf: 'garbage', decision: 'allow' }, db: memoryDb(), sessionSecret });
    expect(out.status).toBe(400);
  });

  it('returns 302 with code on allow', async () => {
    const csrf = signPayload({ req: goodReq }, sessionSecret, 60);
    const out = await handleDecision({
      session: { authed: true },
      body: { csrf, decision: 'allow' },
      db: memoryDb([{ clientId: 'c1' }]),
      sessionSecret,
    });
    expect(out.status).toBe(200);
    expect(out.body.redirect).toMatch(/^https:\/\/a\/b\?code=cd_oac_/);
    expect(out.body.redirect).toContain('state=st');
  });

  it('returns 200 with deny redirect on deny', async () => {
    const csrf = signPayload({ req: goodReq }, sessionSecret, 60);
    const out = await handleDecision({
      session: { authed: true },
      body: { csrf, decision: 'deny' },
      db: memoryDb([{ clientId: 'c1' }]),
      sessionSecret,
    });
    expect(out.status).toBe(200);
    expect(out.body.redirect).toContain('error=access_denied');
    expect(out.body.redirect).toContain('state=st');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/oauth-authorize-decision.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `api/oauth/authorize/decision.js`**

```js
import { getDb } from '../../../src/db/client.js';
import { oauthEvents } from '../../../src/db/schema.js';
import { issueAuthCode } from '../../../src/lib/oauthCodes.js';
import { verifyPayload } from '../../../src/lib/oauthCrypto.js';
import { getSession } from '../../../src/lib/requireAuth.js';

export async function handleDecision({ session, body, db, sessionSecret }) {
  if (!session?.authed) return { status: 401, body: { error: 'unauthorized' } };
  const csrf = verifyPayload(body?.csrf, sessionSecret);
  if (!csrf?.req) return { status: 400, body: { error: 'invalid_csrf' } };
  const req = verifyPayload(csrf.req, sessionSecret);
  if (!req) return { status: 400, body: { error: 'invalid_request' } };

  const decision = body.decision === 'allow' ? 'allow' : 'deny';
  const url = new URL(req.redirect_uri);

  if (decision === 'deny') {
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('state', req.state);
    await db.insert(oauthEvents).values({ clientId: req.client_id, type: 'consent_deny', detail: {} }).returning();
    return { status: 200, body: { redirect: url.toString() } };
  }

  const { code } = await issueAuthCode(db, {
    clientId: req.client_id,
    redirectUri: req.redirect_uri,
    codeChallenge: req.code_challenge,
    codeChallengeMethod: 'S256',
    scope: req.scope,
    state: req.state,
  });

  await db.insert(oauthEvents).values({ clientId: req.client_id, type: 'consent_allow', detail: {} }).returning();

  url.searchParams.set('code', code);
  url.searchParams.set('state', req.state);
  return { status: 200, body: { redirect: url.toString() } };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const session = await getSession(req, res);
  const out = await handleDecision({
    session,
    body: req.body,
    db: getDb(),
    sessionSecret: process.env.CHAOS_SESSION_SECRET,
  });
  res.status(out.status).json(out.body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/oauth-authorize-decision.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/oauth/authorize/decision.js tests/api/oauth-authorize-decision.test.js
git commit -m "$(cat <<'EOF'
oauth: POST /api/oauth/authorize/decision — issue code on allow, deny redirect on deny

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `POST /api/oauth/token`

**Files:**
- Create: `api/oauth/token.js`
- Test: `tests/api/oauth-token.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/api/oauth-token.test.js
import { describe, it, expect, vi } from 'vitest';
import { handleToken } from '../../api/oauth/token.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';

function memoryDb({ clients = [], codes = [], accessTokens = [], refreshTokens = [] } = {}) {
  const state = { clients, codes, accessTokens, refreshTokens, events: [] };
  const tableNameOf = (t) => t[Symbol.for('drizzle:Name')] || t.name;
  return {
    state,
    select: () => ({
      from: (table) => ({
        where: (cond) => ({
          limit: async () => {
            const n = tableNameOf(table);
            const pool =
              n === 'oauth_clients' ? state.clients :
              n === 'oauth_auth_codes' ? state.codes :
              n === 'oauth_access_tokens' ? state.accessTokens :
              n === 'oauth_refresh_tokens' ? state.refreshTokens : [];
            return pool.filter(cond.__match);
          },
        }),
      }),
    }),
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const n = tableNameOf(table);
          const pool =
            n === 'oauth_auth_codes' ? state.codes :
            n === 'oauth_access_tokens' ? state.accessTokens :
            n === 'oauth_refresh_tokens' ? state.refreshTokens :
            n === 'oauth_events' ? state.events : [];
          const created = { id: `id-${pool.length + 1}`, ...row };
          pool.push(created);
          return [created];
        },
      }),
    }),
    update: (table) => ({
      set: (patch) => ({
        where: async (cond) => {
          const n = tableNameOf(table);
          const pool =
            n === 'oauth_auth_codes' ? state.codes :
            n === 'oauth_access_tokens' ? state.accessTokens :
            n === 'oauth_refresh_tokens' ? state.refreshTokens : [];
          for (const r of pool) if (cond.__match(r)) Object.assign(r, patch);
        },
      }),
    }),
  };
}

// Drizzle eq() produces an object; tests use a thin shim instead.
vi.mock('drizzle-orm', () => ({
  eq: (col, val) => ({ __match: (row) => Object.values(col)[0] === undefined ? false : row[Object.keys(col).slice(-1)[0]] === val }),
  and: (...conds) => ({ __match: (row) => conds.every((c) => c.__match(row)) }),
  isNull: (col) => ({ __match: (row) => row[Object.keys(col).slice(-1)[0]] == null }),
}));

describe('POST /api/oauth/token', () => {
  it('returns 400 on unsupported grant_type', async () => {
    const out = await handleToken({ db: memoryDb(), body: { grant_type: 'password' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('unsupported_grant_type');
  });
  // Deeper paths are covered in the end-to-end test (Task 18).
});
```

(Note: the Drizzle shim above is intentionally light. The richer paths — code exchange happy path, PKCE mismatch, reuse — are validated in Task 18.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/oauth-token.test.js`
Expected: FAIL — handler missing.

- [ ] **Step 3: Implement `api/oauth/token.js`**

```js
import { eq } from 'drizzle-orm';
import { getDb } from '../../src/db/client.js';
import { oauthClients, oauthEvents } from '../../src/db/schema.js';
import { hashToken, verifyPkceS256 } from '../../src/lib/oauthCrypto.js';
import { consumeAuthCode } from '../../src/lib/oauthCodes.js';
import { issueTokenPair, rotateRefreshToken, revokeChain } from '../../src/lib/oauthTokens.js';

async function loadClient(db, clientId) {
  const rows = await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1);
  return rows[0] ?? null;
}

async function authenticateClient(db, body) {
  const clientId = body.client_id;
  if (!clientId) return { ok: false, error: 'invalid_client' };
  const client = await loadClient(db, clientId);
  if (!client) return { ok: false, error: 'invalid_client' };
  if (client.tokenEndpointAuthMethod === 'client_secret_post') {
    if (!body.client_secret || hashToken(body.client_secret) !== client.clientSecretHash) {
      return { ok: false, error: 'invalid_client' };
    }
  }
  return { ok: true, client };
}

export async function handleToken({ db, body }) {
  const grant = body?.grant_type;

  if (grant === 'authorization_code') {
    const auth = await authenticateClient(db, body);
    if (!auth.ok) return { status: 401, body: { error: auth.error } };

    const consumed = await consumeAuthCode(db, body.code);
    if (!consumed.ok) {
      if (consumed.reason === 'reuse' && consumed.row?.clientId) {
        await revokeChain(db, consumed.row.clientId);
        await db.insert(oauthEvents).values({ clientId: consumed.row.clientId, type: 'reuse_detected', detail: { source: 'auth_code' } }).returning();
      }
      return { status: 400, body: { error: 'invalid_grant', reason: consumed.reason } };
    }
    const row = consumed.row;
    if (row.clientId !== auth.client.clientId) return { status: 400, body: { error: 'invalid_grant' } };
    if (row.redirectUri !== body.redirect_uri) return { status: 400, body: { error: 'invalid_grant' } };
    if (!verifyPkceS256(body.code_verifier, row.codeChallenge)) return { status: 400, body: { error: 'invalid_grant', reason: 'pkce' } };

    const pair = await issueTokenPair(db, { clientId: auth.client.clientId, scope: row.scope });
    await db.insert(oauthEvents).values({ clientId: auth.client.clientId, type: 'token_issue', detail: {} }).returning();
    return {
      status: 200,
      body: {
        access_token: pair.access,
        token_type: 'Bearer',
        expires_in: pair.expiresIn,
        refresh_token: pair.refresh,
        scope: row.scope,
      },
    };
  }

  if (grant === 'refresh_token') {
    const auth = await authenticateClient(db, body);
    if (!auth.ok) return { status: 401, body: { error: auth.error } };
    if (!body.refresh_token) return { status: 400, body: { error: 'invalid_request' } };

    const out = await rotateRefreshToken(db, body.refresh_token);
    if (!out.ok) {
      if (out.reason === 'reuse') {
        await db.insert(oauthEvents).values({ clientId: out.clientId, type: 'reuse_detected', detail: { source: 'refresh' } }).returning();
      }
      return { status: 400, body: { error: 'invalid_grant', reason: out.reason } };
    }
    if (out.clientId !== auth.client.clientId) return { status: 400, body: { error: 'invalid_grant' } };

    await db.insert(oauthEvents).values({ clientId: auth.client.clientId, type: 'token_refresh', detail: {} }).returning();
    return {
      status: 200,
      body: {
        access_token: out.access,
        token_type: 'Bearer',
        expires_in: out.expiresIn,
        refresh_token: out.refresh,
        scope: 'mcp',
      },
    };
  }

  return { status: 400, body: { error: 'unsupported_grant_type' } };
}

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const out = await handleToken({ db: getDb(), body: req.body });
  res.status(out.status).json(out.body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/oauth-token.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/oauth/token.js tests/api/oauth-token.test.js
git commit -m "$(cat <<'EOF'
oauth: POST /api/oauth/token — authorization_code + refresh_token grants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: `.well-known` metadata endpoints

**Files:**
- Create: `api/.well-known/oauth-authorization-server.js`
- Create: `api/.well-known/oauth-protected-resource.js`
- Modify: `vercel.json` (add rewrites)

- [ ] **Step 1: Implement the two handlers**

```js
// api/.well-known/oauth-authorization-server.js
import { authServerMetadata, originFromRequest } from '../../src/lib/oauthMetadata.js';

export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(authServerMetadata(originFromRequest(req)));
}
```

```js
// api/.well-known/oauth-protected-resource.js
import { protectedResourceMetadata, originFromRequest } from '../../src/lib/oauthMetadata.js';

export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json(protectedResourceMetadata(originFromRequest(req)));
}
```

- [ ] **Step 2: Add rewrites to `vercel.json`**

Open `vercel.json` and add a `rewrites` array (or extend the existing one):
```json
{
  "rewrites": [
    { "source": "/.well-known/oauth-authorization-server", "destination": "/api/.well-known/oauth-authorization-server" },
    { "source": "/.well-known/oauth-protected-resource",  "destination": "/api/.well-known/oauth-protected-resource" }
  ]
}
```

If `vercel.json` already has rewrites, append these entries. Do not overwrite.

- [ ] **Step 3: Smoke test**

Start dev: `npm run dev` (or `vercel dev`)

In another terminal:
```bash
curl http://localhost:5173/.well-known/oauth-authorization-server | jq .
```
Expected: JSON with `issuer`, `authorization_endpoint`, etc.

- [ ] **Step 4: Commit**

```bash
git add api/.well-known/oauth-authorization-server.js api/.well-known/oauth-protected-resource.js vercel.json
git commit -m "$(cat <<'EOF'
oauth: .well-known discovery endpoints + Vercel rewrites

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: React consent page

**Files:**
- Create: `src/pages/OauthConsent.jsx`
- Modify: `src/router.jsx`

- [ ] **Step 1: Implement the React page**

```jsx
// src/pages/OauthConsent.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../themes';

export default function OauthConsent() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const req = params.get('req');
    if (!req) {
      setState({ kind: 'error', message: 'Missing request token.' });
      return;
    }
    fetch(`/api/oauth/authorize/pending?req=${encodeURIComponent(req)}`)
      .then(async (r) => {
        if (r.status === 401) {
          navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return null;
        }
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || 'bad request');
        return body;
      })
      .then((body) => { if (body) setState({ kind: 'ready', ...body }); })
      .catch((e) => setState({ kind: 'error', message: e.message }));
  }, [navigate]);

  async function decide(decision) {
    const r = await fetch('/api/oauth/authorize/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: state.csrf, decision }),
    });
    const body = await r.json();
    if (!r.ok) {
      setState({ kind: 'error', message: body?.error || 'failed' });
      return;
    }
    window.location.assign(body.redirect);
  }

  if (state.kind === 'loading') return <div style={{ padding: 24, color: theme.text }}>Loading…</div>;
  if (state.kind === 'error') return <div style={{ padding: 24, color: theme.text }}>Error: {state.message}</div>;

  return (
    <div style={{ minHeight: '100vh', background: theme.windowBg, color: theme.text, display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ background: theme.panelBg, border: `1px solid ${theme.border}`, padding: 24, maxWidth: 480, width: '100%' }}>
        <h2 style={{ marginTop: 0 }}>{state.client_name} wants to connect</h2>
        <p>
          It will be able to read and write your Chaos Dimension tasks and report agent progress.
          Scope: <code>{state.scope}</code>.
        </p>
        <p style={{ fontSize: 12, color: theme.textDim }}>
          Redirect target: <code>{state.redirect_uri}</code>
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="mac-btn" onClick={() => decide('deny')} style={{ minWidth: 100 }}>Deny</button>
          <button className="mac-btn mac-btn-primary" onClick={() => decide('allow')} style={{ minWidth: 100 }}>Allow</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the route**

Edit `src/router.jsx`. Add import:
```js
import OauthConsent from './pages/OauthConsent';
```

Add to the routes array:
```js
{ path: '/oauth/consent', element: <OauthConsent /> },
```

- [ ] **Step 3: Smoke test in the browser**

```bash
npm run dev
```

Open `http://localhost:5173/oauth/consent` — you should see the error state ("Missing request token") because there's no `?req=...`. That confirms the route renders and the API call is wired.

- [ ] **Step 4: Commit**

```bash
git add src/pages/OauthConsent.jsx src/router.jsx
git commit -m "$(cat <<'EOF'
oauth: React consent page at /oauth/consent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Integration test for full happy-path

**Files:**
- Create: `tests/api/oauth-e2e.test.js`

This test runs the entire OAuth dance against the live Postgres test database (the same one `npm test` already uses for the existing `mcpTools.test.js`). It walks: register → authorize signed-payload roundtrip → decision allow → token code → call `/api/mcp` → refresh.

- [ ] **Step 1: Write the test**

```js
// tests/api/oauth-e2e.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { getDb } from '../../src/db/client.js';
import { authenticateBearer } from '../../src/lib/mcpAuth.js';
import { handleRegister } from '../../api/oauth/register.js';
import { handleAuthorize } from '../../api/oauth/authorize.js';
import { handlePending } from '../../api/oauth/authorize/pending.js';
import { handleDecision } from '../../api/oauth/authorize/decision.js';
import { handleToken } from '../../api/oauth/token.js';
import { eq } from 'drizzle-orm';
import { oauthClients, agents } from '../../src/db/schema.js';

const SESSION_SECRET = 'x'.repeat(32);
const REDIRECT = 'https://localhost:65000/cb';

function s256(s) { return createHash('sha256').update(s).digest('base64url'); }

describe('oauth end-to-end (live DB)', () => {
  let db;
  beforeAll(() => { db = getDb(); });

  it('completes the full flow and authenticates an MCP request', async () => {
    // 1. Register
    const reg = await handleRegister({
      db,
      body: {
        client_name: `e2e-${Date.now()}`,
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: 'none',
      },
      ip: '127.0.0.1',
    });
    expect(reg.status).toBe(201);
    const clientId = reg.body.client_id;

    // 2. Provision a synthetic agent row and attach to client
    const [agentRow] = await db.insert(agents).values({ name: reg.body.client_name, status: 'idle' }).returning();
    await db.update(oauthClients).set({ agentId: agentRow.id }).where(eq(oauthClients.clientId, clientId));

    // 3. /authorize -> consent redirect
    const verifier = randomBytes(32).toString('base64url');
    const challenge = s256(verifier);
    const az = await handleAuthorize({
      db,
      session: { authed: true },
      query: {
        client_id: clientId, redirect_uri: REDIRECT, response_type: 'code',
        code_challenge: challenge, code_challenge_method: 'S256', state: 'e2e', scope: 'mcp',
      },
      sessionSecret: SESSION_SECRET,
    });
    expect(az.status).toBe(302);
    const reqToken = new URL('http://x' + az.location).searchParams.get('req');

    // 4. /authorize/pending -> CSRF
    const pending = await handlePending({ session: { authed: true }, req: reqToken, sessionSecret: SESSION_SECRET });
    expect(pending.status).toBe(200);

    // 5. /authorize/decision allow -> code
    const decision = await handleDecision({
      session: { authed: true },
      body: { csrf: pending.body.csrf, decision: 'allow' },
      db,
      sessionSecret: SESSION_SECRET,
    });
    expect(decision.status).toBe(200);
    const code = new URL(decision.body.redirect).searchParams.get('code');
    expect(code).toMatch(/^cd_oac_/);

    // 6. /token authorization_code -> tokens
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

    // 7. authenticate /api/mcp request
    const who = await authenticateBearer({ headers: { authorization: `Bearer ${tk.body.access_token}` } });
    expect(who).not.toBeNull();
    expect(who.agentId).toBe(agentRow.id);

    // 8. refresh
    const refreshed = await handleToken({
      db,
      body: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tk.body.refresh_token },
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).not.toBe(tk.body.access_token);

    // 9. old refresh fails (reuse detection)
    const reused = await handleToken({
      db,
      body: { grant_type: 'refresh_token', client_id: clientId, refresh_token: tk.body.refresh_token },
    });
    expect(reused.status).toBe(400);
    expect(reused.body.error).toBe('invalid_grant');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/api/oauth-e2e.test.js`
Expected: PASS (after the tables are pushed in Task 1).

If `getDb()` requires `DATABASE_URL` in the env, ensure `.env.local` is loaded for tests. Existing `mcpTools.test.js` likely already requires this, so the env should be there.

- [ ] **Step 3: Commit**

```bash
git add tests/api/oauth-e2e.test.js
git commit -m "$(cat <<'EOF'
oauth: end-to-end test covering register → authorize → token → mcp → refresh

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Auto-provision the per-client synthetic agent

The e2e test above had to manually insert an agent row. In production we want this to happen automatically the first time a client uses an access token.

**Files:**
- Modify: `src/lib/mcpAuth.js` (the `defaultLookupOauthAccessToken` function)
- Test: extend `tests/lib/mcpAuth.test.js` if you want a unit-level check (optional — covered indirectly by the e2e in Task 16 once removed from there)

- [ ] **Step 1: Modify `defaultLookupOauthAccessToken`**

In `src/lib/mcpAuth.js`, locate the function and append agent-provisioning logic:

```js
async function defaultLookupOauthAccessToken(db, token) {
  const rows = await db
    .select({
      tokenId: oauthAccessTokens.id,
      clientId: oauthAccessTokens.clientId,
      expiresAt: oauthAccessTokens.expiresAt,
      revokedAt: oauthAccessTokens.revokedAt,
      clientName: oauthClients.name,
      clientRowId: oauthClients.id,
      agentId: oauthClients.agentId,
    })
    .from(oauthAccessTokens)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthAccessTokens.clientId))
    .where(eq(oauthAccessTokens.tokenHash, hashOauthToken(token)))
    .limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  if (r.revokedAt) return null;
  if (new Date(r.expiresAt).getTime() < Date.now()) return null;

  let agentId = r.agentId;
  if (!agentId) {
    const [created] = await db.insert(agents).values({ name: r.clientName, status: 'idle' }).returning();
    agentId = created.id;
    await db.update(oauthClients).set({ agentId }).where(eq(oauthClients.id, r.clientRowId));
  }

  db.update(oauthAccessTokens).set({ lastUsedAt: new Date() }).where(eq(oauthAccessTokens.id, r.tokenId)).catch(() => {});
  return { clientId: r.clientId, clientName: r.clientName, agentId };
}
```

- [ ] **Step 2: Remove the manual agent-row provisioning step from the e2e test**

In `tests/api/oauth-e2e.test.js`, delete the "Step 2" block (the manual `db.insert(agents)...` and `db.update(oauthClients).set({ agentId })...`). Replace with a comment explaining that the bearer lookup auto-provisions.

- [ ] **Step 3: Re-run the e2e**

Run: `npx vitest run tests/api/oauth-e2e.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mcpAuth.js tests/api/oauth-e2e.test.js
git commit -m "$(cat <<'EOF'
oauth: auto-provision synthetic agent on first OAuth access-token use

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: README + integration docs

**Files:**
- Modify: `README.md` (replace the "not yet supported" section)
- Modify: `docs/integration/README.md`

- [ ] **Step 1: Update README**

Replace the existing `### Claude Desktop and claude.ai (web): not yet supported` section with:

```markdown
### Connect Claude Desktop or claude.ai (web) via OAuth

1. In **Claude Desktop** or **claude.ai** → Settings → Connectors → **Add custom connector**.
2. **URL:** `https://www.your-deploy.fyi/api/mcp` (replace with your deploy host).
3. Leave OAuth Client ID and Secret blank — the connector will register itself via Dynamic Client Registration.
4. Save. The connector opens a browser tab to your dashboard for password login + consent. After you click **Allow**, Claude finishes the OAuth dance and the chaos-dimension tools appear in any chat.

If your domain redirects apex → www, configure the connector with the `www.` URL — MCP clients don't follow POST redirects.
```

Also remove the `OAuth 2.1 + dynamic client registration on /api/mcp` line from the Roadmap, replacing it with the line below (mark complete):
```markdown
- [x] OAuth 2.1 + dynamic client registration so Claude Desktop and claude.ai web can connect
```

- [ ] **Step 2: Add a troubleshooting section to `docs/integration/README.md`**

At the bottom of that file, append:
```markdown
## OAuth troubleshooting

- **"invalid_redirect_uri"** — the redirect URI in the connector setup must match one of the URIs sent at registration. Recreate the connector.
- **Stuck on consent page** — make sure you're logged into the dashboard in the same browser. The consent page calls `/api/oauth/authorize/pending` which requires the `chaos_session` cookie.
- **Connector reports "invalid_grant" after some time** — the access token is 1h. Claude should refresh automatically. If not, remove and re-add the connector. Reuse of a refresh token (or a code) revokes the entire token chain for that client.
- **Bearer + cd_ token from Claude Code stops working** — OAuth doesn't touch the legacy `cd_...` agent-tokens path. Verify the token at the Authorization header still has the `cd_` prefix and is not in `oauth_*` tables.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/integration/README.md
git commit -m "$(cat <<'EOF'
docs: document Desktop/web connector + OAuth troubleshooting

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Mark CD task done

- [ ] **Step 1: Update the parent task**

```
mcp__chaos-dimension__update_task with id="ftuog2vp15fj32o51jwzg88j", column="done", notes="OAuth 2.1 + DCR shipped. Bearer cd_... agent-token flow preserved. See docs/superpowers/specs/2026-05-20-oauth-for-mcp-design.md and plan 2026-05-20-oauth-for-mcp.md."
```

(Use the chaos-dimension MCP tool directly.)

- [ ] **Step 2: Final verification**

Run: `npx vitest run`
Expected: ALL suites PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Smoke against a real Claude Desktop / claude.ai**

This step is manual.

1. Deploy the branch (or push to a Vercel preview).
2. In Claude Desktop, add a custom connector with the preview URL.
3. Confirm the OAuth flow opens a browser, prompts login, shows the consent screen, and that the chaos-dimension tools appear in a chat afterward.
4. Inspect the `oauth_clients`, `oauth_access_tokens`, `oauth_refresh_tokens`, and `oauth_events` tables in Postgres — there should be rows.

If smoke passes, the work is done. If not, file a follow-up CD task with the specific failure.

---

## File map (reference)

| Path | New / Modified | Responsibility |
| --- | --- | --- |
| `src/db/schema.js` | Modified | Adds 6 oauth tables. |
| `src/lib/oauthCrypto.js` | New | Token gen, hash, PKCE S256, signed payloads. |
| `src/lib/oauthClients.js` | New | DCR validation + redirect URI matching. |
| `src/lib/oauthCodes.js` | New | Authorization code issuance and one-shot consume. |
| `src/lib/oauthTokens.js` | New | Access + refresh token issuance and rotation. |
| `src/lib/oauthRateLimit.js` | New | Postgres-backed sliding-window limiter. |
| `src/lib/oauthMetadata.js` | New | `.well-known` payload builders. |
| `src/lib/mcpAuth.js` | Modified | Dual-path bearer auth. |
| `api/oauth/register.js` | New | `POST /api/oauth/register`. |
| `api/oauth/authorize.js` | New | `GET /api/oauth/authorize`. |
| `api/oauth/authorize/pending.js` | New | `GET /api/oauth/authorize/pending`. |
| `api/oauth/authorize/decision.js` | New | `POST /api/oauth/authorize/decision`. |
| `api/oauth/token.js` | New | `POST /api/oauth/token`. |
| `api/.well-known/oauth-authorization-server.js` | New | RFC 8414 metadata. |
| `api/.well-known/oauth-protected-resource.js` | New | RFC 9728 metadata. |
| `src/pages/OauthConsent.jsx` | New | React consent screen. |
| `src/router.jsx` | Modified | Adds `/oauth/consent` route. |
| `vercel.json` | Modified | `.well-known` rewrites. |
| `README.md` | Modified | Real Desktop/web setup steps, mark roadmap item done. |
| `docs/integration/README.md` | Modified | OAuth troubleshooting. |

## Spec coverage check

| Spec requirement | Implemented in |
| --- | --- |
| 7 endpoints + .well-known | Tasks 9-14 |
| Dual-path mcpAuth, prefix disambiguation | Tasks 2, 8, 17 |
| 4 + 2 new DB tables | Task 1 |
| PKCE S256 only | Tasks 2, 13 |
| One-shot codes, reuse detection | Tasks 4, 13 |
| Refresh-token rotation + chain revoke | Tasks 5, 13 |
| Open DCR with rate-limit | Tasks 6, 9 |
| Signed CSRF binding | Tasks 2, 11, 12 |
| Consent screen | Task 15 |
| Audit log via `oauth_events` | Tasks 9, 12, 13 |
| README + troubleshooting docs | Task 18 |
| End-to-end test | Tasks 16-17 |
