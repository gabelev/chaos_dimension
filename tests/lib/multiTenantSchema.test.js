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
