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

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import { withUserContext } from '../../src/lib/userContext.js';
import { runTool } from '../../src/lib/mcpTools.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('MCP manage_workstream tools (live DB)', () => {
  let db;
  let userA, userB;

  beforeAll(async () => {
    db = getDb();
    const [a] = await db.insert(users).values({
      email: `mcpws-a-${createId()}@test.invalid`, name: 'A',
    }).returning();
    const [b] = await db.insert(users).values({
      email: `mcpws-b-${createId()}@test.invalid`, name: 'B',
    }).returning();
    userA = a.id; userB = b.id;
  }, 30000);

  it('create_workstream inserts a row with auto-slug and defaults for color/icon', async () => {
    const label = `Research ${createId()}`;
    const row = await runTool('create_workstream', { label }, { db, userId: userA });
    expect(row.label).toBe(label);
    expect(row.slug).toMatch(/^research-/);
    expect(row.color).toBe('#666666');
    expect(row.icon).toBe('•');
    expect(row.userId).toBe(userA);
  }, 30000);

  it('create_workstream rejects an unslugifiable label', async () => {
    let err;
    try {
      await runTool('create_workstream', { label: '   !!!  ' }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/slug could not be derived/i);
  }, 30000);

  it('create_workstream collision-bumps the slug for a duplicate label', async () => {
    const label = `Studio ${createId()}`;
    const a = await runTool('create_workstream', { label }, { db, userId: userA });
    const b = await runTool('create_workstream', { label }, { db, userId: userA });
    expect(b.slug).not.toBe(a.slug);
    expect(b.slug.startsWith(a.slug)).toBe(true);
  }, 30000);

  it('update_workstream by slug updates label, color, icon — but not slug', async () => {
    const original = await runTool('create_workstream', { label: `Build ${createId()}` }, { db, userId: userA });
    const updated = await runTool('update_workstream', {
      idOrSlug: original.slug,
      label: 'Build (renamed)',
      color: '#112233',
      icon: '🔧',
    }, { db, userId: userA });
    expect(updated.label).toBe('Build (renamed)');
    expect(updated.color).toBe('#112233');
    expect(updated.icon).toBe('🔧');
    expect(updated.slug).toBe(original.slug);
  }, 30000);

  it('update_workstream by id works the same as by slug', async () => {
    const original = await runTool('create_workstream', { label: `Writing ${createId()}` }, { db, userId: userA });
    const updated = await runTool('update_workstream', {
      idOrSlug: original.id,
      icon: '✏️',
    }, { db, userId: userA });
    expect(updated.icon).toBe('✏️');
    expect(updated.id).toBe(original.id);
  }, 30000);

  it('update_workstream throws when no editable fields supplied', async () => {
    const original = await runTool('create_workstream', { label: `Empty ${createId()}` }, { db, userId: userA });
    let err;
    try {
      await runTool('update_workstream', { idOrSlug: original.id }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/no fields to update/i);
  }, 30000);

  it('update_workstream rejects an unknown idOrSlug', async () => {
    let err;
    try {
      await runTool('update_workstream', { idOrSlug: 'nope-' + createId(), label: 'x' }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/unknown workstream/i);
  }, 30000);

  it("update_workstream cannot reach another user's workstream", async () => {
    const ofA = await runTool('create_workstream', { label: `Private ${createId()}` }, { db, userId: userA });
    let err;
    try {
      await runTool('update_workstream', { idOrSlug: ofA.id, label: 'pwned' }, { db, userId: userB });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/unknown workstream/i);
  }, 30000);

  it('delete_workstream removes an empty workstream', async () => {
    const toDelete = await runTool('create_workstream', { label: `Delete ${createId()}` }, { db, userId: userA });
    const result = await runTool('delete_workstream', { idOrSlug: toDelete.id }, { db, userId: userA });
    expect(result.ok).toBe(true);
    expect(result.deleted.id).toBe(toDelete.id);

    // Confirm it's gone
    let err;
    try {
      await runTool('update_workstream', { idOrSlug: toDelete.id, label: 'x' }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/unknown workstream/i);
  }, 30000);

  it('delete_workstream hard-refuses when tasks still reference it', async () => {
    const ws = await runTool('create_workstream', { label: `Busy ${createId()}` }, { db, userId: userA });
    await withUserContext(db, userA, async (tx) => {
      await tx.execute(sql`
        INSERT INTO tasks (id, title, workstream, "column", user_id)
        VALUES (${createId()}, 'pinned', ${ws.id}, 'backlog', ${userA})
      `);
    });
    let err;
    try {
      await runTool('delete_workstream', { idOrSlug: ws.slug }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/cannot delete workstream/i);
    expect(err?.message).toMatch(/1 task/);
  }, 30000);

  it("delete_workstream cannot reach another user's workstream", async () => {
    const ofA = await runTool('create_workstream', { label: `LockedDown ${createId()}` }, { db, userId: userA });
    let err;
    try {
      await runTool('delete_workstream', { idOrSlug: ofA.id }, { db, userId: userB });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/unknown workstream/i);
  }, 30000);
});
