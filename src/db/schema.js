import { pgTable, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const workstreams = pgTable('workstreams', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  userId: text('user_id'),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  title: text('title').notNull(),
  workstream: text('workstream').notNull(),
  column: text('column').notNull(),
  agentDispatchable: boolean('agent_dispatchable').notNull().default(false),
  remoteRunnable: boolean('remote_runnable').notNull().default(false),
  priority: text('priority').notNull().default('med'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  userId: text('user_id'),
});

export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  status: text('status').notNull().default('idle'),
  taskId: text('task_id'),
  startedAt: timestamp('started_at'),
  log: jsonb('log').notNull().default([]),
  hostname: text('hostname'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  userId: text('user_id'),
});

export const agentTokens = pgTable('agent_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  revoked: boolean('revoked').notNull().default(false),
  userId: text('user_id'),
});

export const runs = pgTable('runs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull().references(() => agents.id),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  status: text('status').notNull().default('running'),
  logUrl: text('log_url'),
  notes: text('notes').notNull().default(''),
  userId: text('user_id'),
});

// OAuth tables: FK constraints intentionally omitted.
// Integrity enforced at the application layer (see docs/superpowers/plans/2026-05-20-oauth-for-mcp.md).
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
  userId: text('user_id'),
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

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
