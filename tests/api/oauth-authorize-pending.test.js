import { describe, it, expect } from 'vitest';
import { handlePending } from '../../api/oauth/authorize/pending.js';
import { signPayload } from '../../src/lib/oauthCrypto.js';

describe('GET /api/oauth/authorize/pending', () => {
  it('returns 401 when not authed', async () => {
    const out = await handlePending({ session: {}, req: 'x', sessionSecret: 'a'.repeat(32) });
    expect(out.status).toBe(401);
  });

  it('returns 400 when req payload is missing or bad', async () => {
    const out = await handlePending({ session: { authed: true }, req: 'garbage', sessionSecret: 'a'.repeat(32) });
    expect(out.status).toBe(400);
  });

  it('returns the request details and a fresh CSRF payload on success', async () => {
    const sessionSecret = 'a'.repeat(32);
    const req = signPayload({
      client_id: 'c1', client_name: 'Claude Desktop', redirect_uri: 'https://a/b',
      code_challenge: 'cc', code_challenge_method: 'S256', scope: 'mcp', state: 's',
    }, sessionSecret, 60);
    const out = await handlePending({ session: { authed: true }, req, sessionSecret });
    expect(out.status).toBe(200);
    expect(out.body.client_name).toBe('Claude Desktop');
    expect(out.body.scope).toBe('mcp');
    expect(typeof out.body.csrf).toBe('string');
  });
});
