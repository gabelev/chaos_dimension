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
import { handleRegister } from '../../api/oauth/register.js';

function memoryDb() {
  const state = { clients: [], rateLimits: [], events: [] };
  return {
    state,
    insert: (table) => ({
      values: (row) => ({
        returning: async () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name;
          const target = name === 'oauth_clients' ? state.clients : name === 'oauth_rate_limits' ? state.rateLimits : state.events;
          const created = { id: `id-${target.length + 1}`, ...row };
          target.push(created);
          return [created];
        },
      }),
    }),
    select: () => ({
      from: (table) => ({
        where: () => ({ limit: async () => {
          const name = table[Symbol.for('drizzle:Name')] || table.name;
          if (name === 'oauth_rate_limits') return state.rateLimits.slice(0, 1);
          return [];
        } }),
      }),
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
}

describe('POST /api/oauth/register', () => {
  it('rejects a request missing redirect_uris', async () => {
    const res = await handleRegister({
      db: memoryDb(),
      body: { client_name: 'X' },
      ip: '1.1.1.1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_redirect_uri');
  });

  it('returns client_id (and secret for confidential) on success', async () => {
    const res = await handleRegister({
      db: memoryDb(),
      body: {
        client_name: 'Claude Desktop',
        redirect_uris: ['https://claude.ai/api/mcp/callback'],
        token_endpoint_auth_method: 'client_secret_post',
      },
      ip: '1.1.1.1',
    });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toMatch(/^cdmcp_/);
    expect(typeof res.body.client_secret).toBe('string');
    expect(res.body.redirect_uris).toEqual(['https://claude.ai/api/mcp/callback']);
  });

  it('omits client_secret for public clients', async () => {
    const res = await handleRegister({
      db: memoryDb(),
      body: {
        client_name: 'Claude Desktop',
        redirect_uris: ['https://claude.ai/api/mcp/callback'],
        token_endpoint_auth_method: 'none',
      },
      ip: '1.1.1.1',
    });
    expect(res.status).toBe(201);
    expect(res.body.client_id).toMatch(/^cdmcp_/);
    expect(res.body.client_secret).toBeUndefined();
  });
});
