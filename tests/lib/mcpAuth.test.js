import { describe, it, expect, vi } from 'vitest';
import { authenticateBearer } from '../../src/lib/mcpAuth.js';

describe('authenticateBearer', () => {
  it('returns null when there is no Authorization header', async () => {
    const out = await authenticateBearer({ headers: {} }, { db: null });
    expect(out).toBeNull();
  });

  it('routes a cd_oat_ token to the OAuth access-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(async () => null),
      lookupOauthAccessToken: vi.fn(async () => ({ clientId: 'client-1', clientName: 'Claude Desktop', agentId: 'agent-from-client-1' })),
    };
    const req = { headers: { authorization: 'Bearer cd_oat_xyz' } };
    const out = await authenticateBearer(req, ctx);
    expect(ctx.lookupAgentToken).not.toHaveBeenCalled();
    expect(ctx.lookupOauthAccessToken).toHaveBeenCalled();
    expect(out).toEqual({ agentId: 'agent-from-client-1', agentName: 'Claude Desktop' });
  });

  it('routes a cd_ token to the agent-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(async () => ({ agentId: 'a1', agentName: 'macbook' })),
      lookupOauthAccessToken: vi.fn(async () => { throw new Error('should not be called'); }),
    };
    const out = await authenticateBearer({ headers: { authorization: 'Bearer cd_legacy' } }, ctx);
    expect(out).toEqual({ agentId: 'a1', agentName: 'macbook' });
  });

  it('returns userId from the agent-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(async () => ({ agentId: 'a1', agentName: 'macbook', userId: 'user-1' })),
      lookupOauthAccessToken: vi.fn(),
    };
    const out = await authenticateBearer({ headers: { authorization: 'Bearer cd_legacy' } }, ctx);
    expect(out.userId).toBe('user-1');
  });

  it('returns userId from the OAuth-token path', async () => {
    const ctx = {
      db: {},
      lookupAgentToken: vi.fn(),
      lookupOauthAccessToken: vi.fn(async () => ({ clientId: 'c1', clientName: 'Claude Desktop', agentId: 'a1', userId: 'user-2' })),
    };
    const out = await authenticateBearer({ headers: { authorization: 'Bearer cd_oat_xyz' } }, ctx);
    expect(out.userId).toBe('user-2');
  });
});
