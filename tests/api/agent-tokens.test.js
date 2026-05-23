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
import { mintTokenLogic } from '../../api/agent-tokens/index.js';

function makeFakeDb() {
  const state = { agents: [], agentTokens: [] };
  return {
    state,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => [],
        }),
      }),
    }),
    insert: (table) => ({
      values: (row) => ({
        returning: () => {
          const created = { id: `id-${Date.now()}-${Math.random()}`, ...row };
          if (table && (table[Symbol.for('drizzle:Name')] === 'agents' || table.name === 'agents')) {
            state.agents.push(created);
          } else {
            state.agentTokens.push(created);
          }
          return [created];
        },
      }),
    }),
  };
}

describe('POST /api/agent-tokens (mintTokenLogic)', () => {
  it('returns 400 when label is missing', async () => {
    const result = await mintTokenLogic({ db: makeFakeDb(), body: {}, userId: 'test-user' });
    expect(result.status).toBe(400);
  });

  it('mints a token and returns the raw value once', async () => {
    const result = await mintTokenLogic({ db: makeFakeDb(), body: { label: 'macbook' }, userId: 'test-user' });
    expect(result.status).toBe(201);
    expect(result.body.token).toMatch(/^cd_/);
    expect(result.body.label).toBe('macbook');
    expect(result.body).toHaveProperty('agentId');
  });

  it('stamps userId on both the agent row and the token row', async () => {
    const db = makeFakeDb();
    const result = await mintTokenLogic({ db, body: { label: 'macbook' }, userId: 'test-user' });
    expect(result.status).toBe(201);
    expect(db.state.agents).toHaveLength(1);
    expect(db.state.agents[0].userId).toBe('test-user');
    expect(db.state.agentTokens).toHaveLength(1);
    expect(db.state.agentTokens[0].userId).toBe('test-user');
  });
});
