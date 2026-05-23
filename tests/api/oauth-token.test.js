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
import { handleToken } from '../../api/oauth/token.js';

describe('POST /api/oauth/token', () => {
  it('returns 400 on unsupported grant_type', async () => {
    const out = await handleToken({ db: {}, body: { grant_type: 'password' } });
    expect(out.status).toBe(400);
    expect(out.body.error).toBe('unsupported_grant_type');
  });

  it('returns 400 on missing grant_type', async () => {
    const out = await handleToken({ db: {}, body: {} });
    expect(out.status).toBe(400);
  });
});
