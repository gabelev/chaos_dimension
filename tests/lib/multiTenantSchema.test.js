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
  users, tasks, workstreams, agents, agentTokens, runs, oauthClients,
} from '../../src/db/schema.js';

describe('multi-tenant schema additions', () => {
  it('exports a users table', () => {
    expect(users).toBeDefined();
  });
  it('adds user_id columns to every scoped table', () => {
    expect(tasks.userId).toBeDefined();
    expect(workstreams.userId).toBeDefined();
    expect(agents.userId).toBeDefined();
    expect(agentTokens.userId).toBeDefined();
    expect(runs.userId).toBeDefined();
    expect(oauthClients.userId).toBeDefined();
  });
});
