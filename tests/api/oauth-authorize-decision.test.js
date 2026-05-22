import { describe, it, expect } from 'vitest';
import { handleDecision } from '../../api/oauth/authorize/decision.js';
import { signPayload } from '../../src/lib/oauthCrypto.js';

function memoryDb() {
  const state = { codes: [], events: [], clients: [] };
  return {
    state,
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name;
          const created = { id: `id-${Math.random()}`, ...row };
          if (name === 'oauth_auth_codes') state.codes.push(created);
          else state.events.push(created);
          return [created];
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  };
}

const sessionSecret = 'a'.repeat(32);
const goodReq = signPayload({
  client_id: 'c1', client_name: 'Claude Desktop', redirect_uri: 'https://a/b',
  code_challenge: 'cc', code_challenge_method: 'S256', scope: 'mcp', state: 'st',
}, sessionSecret, 60);

describe('POST /api/oauth/authorize/decision', () => {
  it('returns 401 when not authed', async () => {
    const out = await handleDecision({ session: {}, body: { csrf: 'x', decision: 'allow' }, db: memoryDb(), sessionSecret });
    expect(out.status).toBe(401);
  });

  it('returns 400 on bad CSRF', async () => {
    const out = await handleDecision({ session: { authed: true }, body: { csrf: 'garbage', decision: 'allow' }, db: memoryDb(), sessionSecret });
    expect(out.status).toBe(400);
  });

  it('returns redirect with code on allow', async () => {
    const csrf = signPayload({ req: goodReq }, sessionSecret, 60);
    const out = await handleDecision({
      session: { authed: true },
      body: { csrf, decision: 'allow' },
      db: memoryDb(),
      sessionSecret,
    });
    expect(out.status).toBe(200);
    expect(out.body.redirect).toMatch(/^https:\/\/a\/b\?code=cd_oac_/);
    expect(out.body.redirect).toContain('state=st');
  });

  it('returns deny redirect on deny', async () => {
    const csrf = signPayload({ req: goodReq }, sessionSecret, 60);
    const out = await handleDecision({
      session: { authed: true },
      body: { csrf, decision: 'deny' },
      db: memoryDb(),
      sessionSecret,
    });
    expect(out.status).toBe(200);
    expect(out.body.redirect).toContain('error=access_denied');
    expect(out.body.redirect).toContain('state=st');
  });

  it('stamps oauth_clients.user_id on allow', async () => {
    const db = memoryDb();
    db.state.clients = [{ clientId: 'c1', userId: null }];
    db.update = () => ({
      set: (patch) => ({
        where: async () => {
          if ('userId' in patch && db.state.clients[0].userId === null) {
            db.state.clients[0].userId = patch.userId;
          }
        },
      }),
    });
    const csrf = signPayload({ req: goodReq }, sessionSecret, 60);
    const out = await handleDecision({
      session: { authed: true, userId: 'owner-cuid' },
      body: { csrf, decision: 'allow' },
      db,
      sessionSecret,
    });
    expect(out.status).toBe(200);
    expect(db.state.clients[0].userId).toBe('owner-cuid');
  });
});
