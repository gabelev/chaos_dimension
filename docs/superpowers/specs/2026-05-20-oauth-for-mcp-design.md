# OAuth 2.1 + Dynamic Client Registration for `/api/mcp`

**Status:** design approved 2026-05-20
**Related task:** `ftuog2vp15fj32o51jwzg88j` (Chaos Dimension backlog)

## Goal

Let Claude Desktop and claude.ai (web) connect to the chaos-dimension MCP server via the platform's standard "Add custom connector" flow. Today the connector dialog only accepts OAuth 2.1 (with Dynamic Client Registration), and the server only speaks static bearer tokens. This spec adds OAuth as a parallel auth path so the existing `cd_...` bearer flow used by Claude Code keeps working unchanged.

## Non-goals

- OIDC (`id_token`, userinfo endpoint).
- Token introspection (RFC 7662) and token revocation (RFC 7009) endpoints. Revocation happens from the dashboard.
- Per-tool scopes. A single `mcp` scope is issued.
- Multi-tenancy. The deploy is single-owner; OAuth gates "this client is allowed to act as the owner."

## Decisions (locked in)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Implementation | Hand-rolled, minimal | MCP-required surface is small and well-defined. No new prod deps. |
| Consent UX | Explicit consent screen | Standard OAuth UX, gives visibility into which client is connecting. |
| DCR policy | Open DCR | Required by MCP spec for Claude clients to work out of the box. Protected by consent screen. |
| Token format | Opaque + refresh, 1h access / 30d refresh | Easy revocation, matches existing `agent_tokens` style, supports automatic refresh by Claude clients. |
| Bearer compatibility | Dual-path in `authenticateMcpRequest` | Disambiguate by prefix: `cd_oat_` → oauth_access_tokens, else → agent_tokens. |

## Architecture

### New HTTP endpoints

| Endpoint | Spec | Notes |
| --- | --- | --- |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 | Discovery metadata so clients find the other endpoints. |
| `GET /.well-known/oauth-protected-resource` | RFC 9728 | Advertises the auth server URL. Required for MCP resource-server discovery. |
| `POST /api/oauth/register` | RFC 7591 | Dynamic Client Registration. Open. Returns `client_id` and (for confidential clients) `client_secret`. |
| `GET /api/oauth/authorize` | OAuth 2.1 | If no iron-session cookie, 302 to `/login?next=...`. If cookie valid, 302 to the React route `/oauth/consent`. |
| `GET /api/oauth/authorize/pending` | (custom) | Returns the pending authorization request (client name, scope) and a signed CSRF payload. Requires iron-session. |
| `POST /api/oauth/authorize/decision` | (custom) | Receives Allow/Deny click from the consent screen. Validates the signed CSRF payload tied to the iron-session. Issues authorization code on Allow and returns the redirect URL. |
| `POST /api/oauth/token` | OAuth 2.1 | Handles `grant_type=authorization_code` and `grant_type=refresh_token`. Validates PKCE on code exchange. |

Vercel routing: `.well-known` routes ship via a rewrite in `vercel.json` (or `vercel.ts`) that maps `/.well-known/oauth-*` to a Vercel Function.

### Frontend

New React route: `/oauth/consent`

- On mount, calls a new `GET /api/oauth/authorize/pending?req_id=...` that returns the pending authorization request (client name, requested scope) plus a signed CSRF payload bound to the iron-session.
- Renders Allow / Deny buttons styled per the active theme.
- POSTs the user's decision and the CSRF payload to `/api/oauth/authorize/decision`. On success, the response includes the redirect URL with `?code=...&state=...`; the page does `window.location = redirect`.

### Library modules

All new files under `src/lib/`:

| Module | Responsibility |
| --- | --- |
| `oauthCrypto.js` | Generate prefixed random tokens, hash (SHA-256), PKCE S256 verifier check, signed CSRF payloads. |
| `oauthClients.js` | DCR request validation (redirect URI shape, name length), persistence to `oauth_clients`. |
| `oauthCodes.js` | Issue / look up / consume authorization codes. One-shot, 60s TTL, single use enforced via `consumedAt`. |
| `oauthTokens.js` | Issue access + refresh token pairs, look up by hash, mark revoked. Refresh-token rotation. |
| `oauthMetadata.js` | Build the two `.well-known` payloads from env. |

Modified:

- `src/lib/mcpAuth.js` — add a fallback path: if bearer doesn't match `agent_tokens`, try `oauth_access_tokens`. Returns the same `{ agentId, agentName }` shape for downstream callers; OAuth-issued tokens map to a synthetic agent row named after the OAuth client (one stable agent per OAuth client).

## Database schema

Four new tables, all additive, no migrations to existing tables.

```js
// src/db/schema.js additions
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  clientId: text('client_id').notNull().unique(),
  clientSecretHash: text('client_secret_hash'), // null for public clients
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').notNull(), // array of exact-match URIs
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull(), // 'client_secret_post' | 'none'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  agentId: text('agent_id'), // synthetic agent row, populated lazily on first token use
});

export const oauthAuthCodes = pgTable('oauth_auth_codes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  codeHash: text('code_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  codeChallengeMethod: text('code_challenge_method').notNull(), // 'S256' only
  scope: text('scope').notNull(),
  state: text('state'),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
});

export const oauthRefreshTokens = pgTable('oauth_refresh_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  accessTokenId: text('access_token_id').references(() => oauthAccessTokens.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const oauthEvents = pgTable('oauth_events', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  clientId: text('client_id'),
  type: text('type').notNull(), // 'register' | 'consent_allow' | 'consent_deny' | 'token_issue' | 'token_refresh' | 'token_revoke' | 'reuse_detected'
  detail: jsonb('detail').notNull().default({}),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const oauthRateLimits = pgTable('oauth_rate_limits', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  bucket: text('bucket').notNull(), // e.g. 'register:1.2.3.4'
  windowStart: timestamp('window_start').notNull(),
  count: integer('count').notNull().default(0),
});
```

(`integer` must be added to the existing schema imports.)

Token prefixes:

- `cd_oac_` — authorization codes (in transit only; hashed in DB).
- `cd_oat_` — access tokens (in transit only; hashed in DB).
- `cd_ort_` — refresh tokens (in transit only; hashed in DB).

## Flow

```
Claude Desktop                  Browser              Chaos Dimension
     |                              |                         |
     |--- discover /.well-known --->|----------------------->| (returns metadata)
     |                              |                         |
     |--- POST /register ---------->|----------------------->| (returns client_id + secret)
     |                              |                         |
     |--- open /authorize?... ------|----------------------->| (302 -> /login if no session)
     |                              |<-- consent screen ----- |
     |                              |--- click Allow -------->|
     |<-- 302 with code ------------|<------------------------|
     |                              |                         |
     |--- POST /token (code+PKCE) ->|----------------------->| (returns access+refresh)
     |                              |                         |
     |--- POST /api/mcp w/ Bearer ->|----------------------->| (mcpAuth checks oauth_access_tokens)
     |<-- tool result --------------|<------------------------|
     |                              |                         |
     |--- (1h later) POST /token (refresh) ----------------->| (returns new access+refresh)
```

Authorize-endpoint guards:

1. No iron-session cookie → 302 to `/login?next=<original-authorize-url>`.
2. Session valid, no decision yet → 302 to React route `/oauth/consent?req_id=<short-lived-id>`. The page fetches the pending request details and renders Allow/Deny.
3. Decision recorded → 302 to client `redirect_uri` with `?code=...&state=...`.

Refresh-token rotation: each `refresh_token` grant invalidates the old refresh token and issues a new pair. Reuse of a consumed refresh token revokes the entire token chain for that client.

## Security checklist (non-negotiables)

- **PKCE required.** S256 only; reject `plain`. Reject codes without a verifier match.
- **Authorization codes are one-shot.** First successful exchange sets `consumedAt`. Reuse → revoke every access + refresh token previously issued from that code.
- **redirect_uri exact-match allowlist per client.** No wildcards, no substring matching, no path tricks (URL normalization before comparison).
- **All tokens stored hashed (SHA-256).** Same pattern as the existing `agent_tokens`.
- **No public clients without PKCE.** Confidential clients (`token_endpoint_auth_method=client_secret_post`) must present `client_secret` at `/token`.
- **`state` parameter required at `/authorize`** and echoed back unchanged.
- **Rate limit `/register` and `/token`.** Implemented as a Postgres-backed sliding-window counter (small table, one row per source IP + endpoint). In-memory was considered but rejected: Vercel Functions are per-invocation, so an in-memory bucket leaks across cold starts. Postgres is the only shared store available without adding KV.
- **CSRF on the consent decision POST.** A signed payload binds the decision to the user's iron-session and the pending authorization. Signed using a key derived from `CHAOS_SESSION_SECRET`. 5-minute TTL.
- **OAuth-issued tokens never rendered in the dashboard UI.** Token values exist only in the HTTP response; only hashes persist.
- **Audit log.** Every consent decision and token issuance writes a row to a new `oauth_events` table (see schema below). Append-only; never deleted from app code.

## Testing

| Layer | Coverage |
| --- | --- |
| Unit | `oauthCrypto` (PKCE check, signed payload round-trip, prefix detection), `oauthClients` (redirect URI normalization + match), `oauthCodes` (issue / consume / reuse-detection), `oauthTokens` (issue / refresh-rotate / revoke). |
| Integration | Each endpoint via supertest-style handler invocation: register success + invalid redirect, authorize redirect when unauthenticated, authorize consent fetch, decision POST happy path + CSRF mismatch, token code exchange + PKCE mismatch + reuse, token refresh happy + reuse-detection. |
| End-to-end | Happy-path walk: register → authorize → consent allow → token → call `/api/mcp` (lists tools) → wait past 1h (test clock) → refresh → call `/api/mcp` again. |
| Negative cases | Expired code, reused code, wrong PKCE verifier, wrong redirect_uri, mismatched state, revoked refresh token, missing client_secret on confidential client. |

## Open questions

- None at design time. Implementation may surface edge cases that warrant follow-up tasks; track in CD as they arise.

## Out of scope (revisit later)

- OIDC.
- RFC 7662 (introspection) and RFC 7009 (revocation) endpoints.
- Per-tool scopes.
- Token issuance audit dashboard (only DB rows for now).
- Bot-protection beyond IP-bucket rate-limit (e.g., signed challenge on `/register`).
