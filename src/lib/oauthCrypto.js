// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
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

// Short-lived HMAC-signed envelope. Intended for in-flight CSRF/state binding,
// not for general-purpose tokens. The serialized object must not contain an
// `exp` key — it's reserved for the expiry stamp.
export function signPayload(obj, secret, ttlSeconds) {
  if (obj && typeof obj === 'object' && 'exp' in obj) {
    throw new Error('signPayload: payload may not contain reserved key "exp"');
  }
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
