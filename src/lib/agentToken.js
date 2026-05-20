import { randomBytes, createHash } from 'node:crypto';

export const TOKEN_PREFIX = 'cd_';

export function generateToken() {
  const body = randomBytes(32).toString('base64url');
  return `${TOKEN_PREFIX}${body}`;
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
