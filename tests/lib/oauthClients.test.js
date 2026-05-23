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
import { validateRegistrationRequest, normalizeRedirectUri, redirectUriAllowed } from '../../src/lib/oauthClients.js';

describe('oauthClients.validateRegistrationRequest', () => {
  it('accepts a minimal valid request', () => {
    const r = validateRegistrationRequest({
      client_name: 'Claude Desktop',
      redirect_uris: ['https://claude.ai/api/mcp/callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects when redirect_uris is missing or empty', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: [] }).ok).toBe(false);
    expect(validateRegistrationRequest({ client_name: 'x' }).ok).toBe(false);
  });

  it('rejects non-https redirect URIs (except localhost)', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://evil.example/cb'] }).ok).toBe(false);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://localhost:1234/cb'] }).ok).toBe(true);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['http://127.0.0.1/cb'] }).ok).toBe(true);
  });

  it('rejects URIs with a fragment', () => {
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: ['https://example.com/cb#frag'] }).ok).toBe(false);
  });

  it('rejects client_name longer than 200 chars', () => {
    expect(validateRegistrationRequest({ client_name: 'x'.repeat(201), redirect_uris: ['https://a/b'] }).ok).toBe(false);
  });

  it('rejects redirect URIs with userinfo', () => {
    expect(validateRegistrationRequest({
      client_name: 'x',
      redirect_uris: ['https://user:pw@victim.com/cb'],
    }).ok).toBe(false);
  });

  it('rejects subdomains masquerading as localhost', () => {
    expect(validateRegistrationRequest({
      client_name: 'x',
      redirect_uris: ['http://localhost.attacker.com/cb'],
    }).ok).toBe(false);
  });

  it('accepts http://[::1]/cb (IPv6 loopback)', () => {
    expect(validateRegistrationRequest({
      client_name: 'x',
      redirect_uris: ['http://[::1]/cb'],
    }).ok).toBe(true);
  });

  it('rejects whitespace-only client_name', () => {
    expect(validateRegistrationRequest({
      client_name: '   ',
      redirect_uris: ['https://a/b'],
    }).ok).toBe(false);
  });

  it('rejects unsupported token_endpoint_auth_method', () => {
    expect(validateRegistrationRequest({
      client_name: 'x',
      redirect_uris: ['https://a/b'],
      token_endpoint_auth_method: 'client_secret_basic',
    }).ok).toBe(false);
  });

  it('rejects more than MAX_REDIRECT_URIS', () => {
    const many = Array.from({ length: 11 }, (_, i) => `https://a/b${i}`);
    expect(validateRegistrationRequest({ client_name: 'x', redirect_uris: many }).ok).toBe(false);
  });

  it('rejects non-object body', () => {
    expect(validateRegistrationRequest(null).ok).toBe(false);
    expect(validateRegistrationRequest('string').ok).toBe(false);
  });
});

describe('redirectUriAllowed', () => {
  it('matches exact registered uris after normalization', () => {
    expect(redirectUriAllowed('https://A.example.com/cb', ['https://a.example.com/cb'])).toBe(true);
    expect(redirectUriAllowed('https://a.example.com/cb', ['https://a.example.com/other'])).toBe(false);
  });

  it('strips trailing slashes during comparison consistently', () => {
    expect(normalizeRedirectUri('https://x.example/cb/')).toBe('https://x.example/cb');
    expect(normalizeRedirectUri('https://x.example/cb')).toBe('https://x.example/cb');
  });

  it('returns false for malformed candidate', () => {
    expect(redirectUriAllowed('not-a-url', ['https://a/b'])).toBe(false);
  });
});
