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
import { issueTokenPair } from '../../src/lib/oauthTokens.js';
import { hashToken } from '../../src/lib/oauthCrypto.js';

function fakeDb() {
  const state = { access: [], refresh: [] };
  // Drizzle's pgTable objects expose the symbol; resolve by inspecting which fields the inserted row has.
  return {
    state,
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          // Refresh-token rows have accessTokenId; access-token rows have scope+expiresAt without accessTokenId.
          const isRefresh = 'accessTokenId' in row;
          const target = isRefresh ? state.refresh : state.access;
          const created = { id: `id-${target.length + 1}`, ...row };
          target.push(created);
          return [created];
        },
      }),
    }),
  };
}

describe('oauthTokens.issueTokenPair', () => {
  it('returns prefixed tokens and persists hashes', async () => {
    const fake = fakeDb();
    const out = await issueTokenPair(fake, { clientId: 'c1', scope: 'mcp' });
    expect(out.access).toMatch(/^cd_oat_/);
    expect(out.refresh).toMatch(/^cd_ort_/);
    expect(typeof out.expiresIn).toBe('number');
    expect(out.expiresIn).toBeGreaterThan(0);
    expect(fake.state.access).toHaveLength(1);
    expect(fake.state.refresh).toHaveLength(1);
    expect(fake.state.access[0].tokenHash).toBe(hashToken(out.access));
    expect(fake.state.refresh[0].tokenHash).toBe(hashToken(out.refresh));
    expect(fake.state.refresh[0].accessTokenId).toBe(fake.state.access[0].id);
  });
});
