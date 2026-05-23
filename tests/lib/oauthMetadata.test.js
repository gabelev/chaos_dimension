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
import { authServerMetadata, protectedResourceMetadata, originFromRequest } from '../../src/lib/oauthMetadata.js';

describe('oauthMetadata', () => {
  it('returns standard authorization-server fields', () => {
    const m = authServerMetadata('https://example.com');
    expect(m.issuer).toBe('https://example.com');
    expect(m.authorization_endpoint).toBe('https://example.com/api/oauth/authorize');
    expect(m.token_endpoint).toBe('https://example.com/api/oauth/token');
    expect(m.registration_endpoint).toBe('https://example.com/api/oauth/register');
    expect(m.code_challenge_methods_supported).toEqual(['S256']);
    expect(m.grant_types_supported).toContain('authorization_code');
    expect(m.grant_types_supported).toContain('refresh_token');
    expect(m.response_types_supported).toEqual(['code']);
  });

  it('returns protected-resource metadata pointing at the auth server', () => {
    const m = protectedResourceMetadata('https://example.com');
    expect(m.resource).toBe('https://example.com/api/mcp');
    expect(m.authorization_servers).toEqual(['https://example.com']);
  });

  it('derives the origin from x-forwarded headers', () => {
    expect(originFromRequest({ headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'a.b' } })).toBe('https://a.b');
    expect(originFromRequest({ headers: { host: 'a.b' } })).toBe('https://a.b');
  });
});
