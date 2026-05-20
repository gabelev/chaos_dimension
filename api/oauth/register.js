import { randomBytes } from 'node:crypto';
import { getDb } from '../../src/db/client.js';
import { oauthClients, oauthEvents } from '../../src/db/schema.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';
import { validateRegistrationRequest } from '../../src/lib/oauthClients.js';
import { checkRateLimit } from '../../src/lib/oauthRateLimit.js';

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

  const out = {
    client_id: clientId,
    client_name: v.value.name,
    redirect_uris: v.value.redirectUris,
    token_endpoint_auth_method: v.value.tokenEndpointAuthMethod,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  };
  if (secret) out.client_secret = secret;
  return { status: 201, body: out };
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
