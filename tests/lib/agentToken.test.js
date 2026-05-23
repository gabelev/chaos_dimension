// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { describe, it, expect } from 'vitest';
import { generateToken, hashToken, TOKEN_PREFIX } from '../../src/lib/agentToken.js';

describe('agentToken', () => {
  it('generates a token with the cd_ prefix and ~43 char body', () => {
    const t = generateToken();
    expect(t.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t.length).toBeLessThanOrEqual(64);
  });

  it('generates unique tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it('hashes deterministically', () => {
    const t = 'cd_known_token_value_for_test';
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it('hashes to a 64-char hex string', () => {
    const h = hashToken('cd_xyz');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different tokens hash differently', () => {
    expect(hashToken('cd_a')).not.toBe(hashToken('cd_b'));
  });
});
