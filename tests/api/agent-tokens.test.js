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
    const result = await mintTokenLogic({ db: makeFakeDb(), body: {} });
    expect(result.status).toBe(400);
  });

  it('mints a token and returns the raw value once', async () => {
    const result = await mintTokenLogic({ db: makeFakeDb(), body: { label: 'macbook' } });
    expect(result.status).toBe(201);
    expect(result.body.token).toMatch(/^cd_/);
    expect(result.body.label).toBe('macbook');
    expect(result.body).toHaveProperty('agentId');
  });
});
