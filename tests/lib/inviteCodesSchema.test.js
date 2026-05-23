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
import { inviteCodes } from '../../src/db/schema.js';

describe('inviteCodes schema', () => {
  it('exports inviteCodes with the expected columns', () => {
    expect(inviteCodes).toBeDefined();
    expect(inviteCodes.id).toBeDefined();
    expect(inviteCodes.code).toBeDefined();
    expect(inviteCodes.createdById).toBeDefined();
    expect(inviteCodes.claimedByUserId).toBeDefined();
    expect(inviteCodes.claimedAt).toBeDefined();
    expect(inviteCodes.note).toBeDefined();
    expect(inviteCodes.createdAt).toBeDefined();
  });
});
