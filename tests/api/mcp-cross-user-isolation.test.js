import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import { withUserContext } from '../../src/lib/userContext.js';
import { authenticateBearer } from '../../src/lib/mcpAuth.js';
import { runTool } from '../../src/lib/mcpTools.js';
import { mintTokenLogic } from '../../api/agent-tokens/index.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('MCP cross-user isolation via agent tokens (live DB)', () => {
  let db;
  let userA, userB;
  let tokenA, tokenB;
  let markerTitle;
  let wsA;

  beforeAll(async () => {
    db = getDb();
    // Create two throwaway users directly. users is not RLS-scoped.
    const [a] = await db.insert(users).values({
      email: `mcpiso-a-${createId()}@test.invalid`, name: 'A',
    }).returning();
    const [b] = await db.insert(users).values({
      email: `mcpiso-b-${createId()}@test.invalid`, name: 'B',
    }).returning();
    userA = a.id; userB = b.id;

    // Mint a cd_... agent token for each user via the same logic
    // /api/agent-tokens uses. mintTokenLogic does an INSERT into agents
    // (which IS RLS-scoped), so it must run inside a withUserContext block
    // — same as the route handler does (per MT7).
    const minted = async (uid, label) => {
      const out = await withUserContext(db, uid, async (tx) => {
        return mintTokenLogic({ db: tx, body: { label }, userId: uid });
      });
      return out.body.token;
    };
    tokenA = await minted(userA, 'iso-A');
    tokenB = await minted(userB, 'iso-B');

    // Plant a unique task owned by A. The mcpTools require a workstream
    // FK target, so insert one too — both under A's RLS context.
    markerTitle = `mcpiso-${createId()}`;
    wsA = createId();
    await withUserContext(db, userA, async (tx) => {
      await tx.execute(sql`
        INSERT INTO workstreams (id, label, color, icon, slug, user_id)
        VALUES (${wsA}, 'mcpiso A', '#000', 'x', ${`mcpiso-a-${createId()}`}, ${userA})
      `);
      await tx.execute(sql`
        INSERT INTO tasks (id, title, workstream, "column", user_id)
        VALUES (${createId()}, ${markerTitle}, ${wsA}, 'backlog', ${userA})
      `);
    });
  }, 30000);

  it("user A's token resolves to user A's userId", async () => {
    const hit = await authenticateBearer({ headers: { authorization: `Bearer ${tokenA}` } });
    expect(hit).not.toBeNull();
    expect(hit.userId).toBe(userA);
  }, 30000);

  it("user B's token resolves to user B's userId, never user A's", async () => {
    const hit = await authenticateBearer({ headers: { authorization: `Bearer ${tokenB}` } });
    expect(hit).not.toBeNull();
    expect(hit.userId).toBe(userB);
    expect(hit.userId).not.toBe(userA);
  }, 30000);

  it("list_tasks via user A's token sees the marker task; user B's token does NOT", async () => {
    const authA = await authenticateBearer({ headers: { authorization: `Bearer ${tokenA}` } });
    const tasksAsA = await runTool('list_tasks', {}, { db, agentId: authA.agentId, agentName: authA.agentName, userId: authA.userId });
    expect(tasksAsA.some((t) => t.title === markerTitle)).toBe(true);

    const authB = await authenticateBearer({ headers: { authorization: `Bearer ${tokenB}` } });
    const tasksAsB = await runTool('list_tasks', {}, { db, agentId: authB.agentId, agentName: authB.agentName, userId: authB.userId });
    expect(tasksAsB.some((t) => t.title === markerTitle)).toBe(false);
  }, 30000);

  it("user B's token cannot create_task into user A's workstream", async () => {
    const authB = await authenticateBearer({ headers: { authorization: `Bearer ${tokenB}` } });
    // user A's workstream id is scoped to A, so resolveWorkstreamId (inside
    // mcpTools) won't find it under B's RLS context. create_task should
    // reject with "unknown workstream".
    let rejected = false;
    try {
      await runTool('create_task', { title: 'sneaky', workstream: wsA }, {
        db, agentId: authB.agentId, agentName: authB.agentName, userId: authB.userId,
      });
    } catch (e) {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }, 30000);
});
