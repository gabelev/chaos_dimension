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
import { handleAuthorize } from '../../api/oauth/authorize.js';

function db(clients = []) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => clients.slice(0, 1) }),
      }),
    }),
  };
}

const validQuery = {
  client_id: 'c1', redirect_uri: 'https://a/b', response_type: 'code',
  code_challenge: 'cc', code_challenge_method: 'S256', state: 's', scope: 'mcp',
};

describe('GET /api/oauth/authorize', () => {
  it('returns 400 when required params are missing', async () => {
    const out = await handleAuthorize({
      db: db([]),
      session: { authed: true },
      query: { client_id: 'x' },
    });
    expect(out.status).toBe(400);
  });

  it('rejects unknown clients', async () => {
    const out = await handleAuthorize({
      db: db([]),
      session: { authed: true },
      query: validQuery,
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_client');
  });

  it('rejects mismatched redirect_uri', async () => {
    const out = await handleAuthorize({
      db: db([{ clientId: 'c1', redirectUris: ['https://a/b'] }]),
      session: { authed: true },
      query: { ...validQuery, redirect_uri: 'https://evil/cb' },
    });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('invalid_redirect_uri');
  });

  it('redirects to login when not authed', async () => {
    const out = await handleAuthorize({
      db: db([{ clientId: 'c1', redirectUris: ['https://a/b'] }]),
      session: {},
      query: validQuery,
      originalUrl: '/api/oauth/authorize?x=1',
    });
    expect(out.status).toBe(302);
    expect(out.location).toContain('/login?next=');
  });

  it('redirects to /oauth/consent when authed', async () => {
    const out = await handleAuthorize({
      db: db([{ clientId: 'c1', redirectUris: ['https://a/b'], name: 'Claude Desktop' }]),
      session: { authed: true },
      query: validQuery,
      sessionSecret: 'x'.repeat(32),
    });
    expect(out.status).toBe(302);
    expect(out.location).toMatch(/^\/oauth\/consent\?req=/);
  });
});
