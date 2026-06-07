// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  users, tasks, workstreams, agents, agentTokens, runs, oauthClients,
} from '../../src/db/schema.js';
import { getMigrationDb } from '../../src/db/client.js';

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
  it('tasks has a created_via column defaulting to ui', async () => {
    const db = getMigrationDb();
    const result = await db.execute(sql`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'created_via'
    `);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].column_default).toMatch(/'ui'/);
    expect(result.rows[0].is_nullable).toBe('NO');
  });

  it('users has a coach_dismissed column defaulting to false', async () => {
    const db = getMigrationDb();
    const result = await db.execute(sql`
      SELECT column_name, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'coach_dismissed'
    `);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].column_default).toMatch(/false/);
    expect(result.rows[0].is_nullable).toBe('NO');
  });
});
