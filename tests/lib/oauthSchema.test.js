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
import {
  oauthClients,
  oauthAuthCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  oauthEvents,
  oauthRateLimits,
} from '../../src/db/schema.js';

describe('oauth schema', () => {
  it('exports all six oauth tables', () => {
    expect(oauthClients).toBeDefined();
    expect(oauthAuthCodes).toBeDefined();
    expect(oauthAccessTokens).toBeDefined();
    expect(oauthRefreshTokens).toBeDefined();
    expect(oauthEvents).toBeDefined();
    expect(oauthRateLimits).toBeDefined();
  });
});
