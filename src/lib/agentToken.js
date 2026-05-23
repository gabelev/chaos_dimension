// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { randomBytes, createHash } from 'node:crypto';

export const TOKEN_PREFIX = 'cd_';

export function generateToken() {
  const body = randomBytes(32).toString('base64url');
  return `${TOKEN_PREFIX}${body}`;
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
