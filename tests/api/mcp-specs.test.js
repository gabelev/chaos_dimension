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
import { createId } from '@paralleldrive/cuid2';
import { getDb } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import { runTool } from '../../src/lib/mcpTools.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('MCP spec tools (live DB)', () => {
  let db;
  let userA, userB;
  let wsA, taskA;

  beforeAll(async () => {
    db = getDb();
    const [a] = await db.insert(users).values({
      email: `specs-a-${createId()}@test.invalid`, name: 'A',
    }).returning();
    const [b] = await db.insert(users).values({
      email: `specs-b-${createId()}@test.invalid`, name: 'B',
    }).returning();
    userA = a.id; userB = b.id;

    wsA = await runTool('create_workstream', { label: `Specs WS ${createId()}` }, { db, userId: userA });
    taskA = await runTool('create_task', { title: 'Spec target task', workstream: wsA.id }, { db, userId: userA });
  }, 30000);

  it('create_spec attaches to a task (version 1, createdVia mcp)', async () => {
    const spec = await runTool('create_spec', {
      title: 'Task spec', content: '# Goals\nDo the thing.', task: taskA.id,
    }, { db, userId: userA });
    expect(spec.title).toBe('Task spec');
    expect(spec.taskId).toBe(taskA.id);
    expect(spec.workstreamId).toBeNull();
    expect(spec.version).toBe(1);
    expect(spec.createdVia).toBe('mcp');
    expect(spec.userId).toBe(userA);
  }, 30000);

  it('create_spec attaches to a workstream by slug', async () => {
    const spec = await runTool('create_spec', {
      title: 'WS spec', content: 'shared context', workstream: wsA.slug,
    }, { db, userId: userA });
    expect(spec.workstreamId).toBe(wsA.id);
    expect(spec.taskId).toBeNull();
  }, 30000);

  it('create_spec rejects zero targets', async () => {
    let err;
    try {
      await runTool('create_spec', { title: 'x', content: 'y' }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/exactly one of task or workstream/i);
  }, 30000);

  it('create_spec rejects two targets', async () => {
    let err;
    try {
      await runTool('create_spec', {
        title: 'x', content: 'y', task: taskA.id, workstream: wsA.id,
      }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/exactly one of task or workstream/i);
  }, 30000);

  it('create_spec rejects an unknown task', async () => {
    let err;
    try {
      await runTool('create_spec', { title: 'x', content: 'y', task: 'nope-' + createId() }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/unknown task/i);
  }, 30000);

  it('list_specs filters by task and by workstream', async () => {
    const byTask = await runTool('list_specs', { task: taskA.id }, { db, userId: userA });
    expect(byTask.every(s => s.taskId === taskA.id)).toBe(true);
    expect(byTask.length).toBeGreaterThanOrEqual(1);

    const byWs = await runTool('list_specs', { workstream: wsA.slug }, { db, userId: userA });
    expect(byWs.every(s => s.workstreamId === wsA.id)).toBe(true);
    expect(byWs.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('update_spec content change bumps version + records a retrievable revision', async () => {
    const spec = await runTool('create_spec', {
      title: 'Evolving', content: 'v1 body', task: taskA.id,
    }, { db, userId: userA });

    const updated = await runTool('update_spec', {
      id: spec.id, content: 'v2 body', note: 'expanded',
    }, { db, userId: userA });
    expect(updated.version).toBe(2);
    expect(updated.content).toBe('v2 body');

    const full = await runTool('get_spec', { id: spec.id, includeRevisions: true }, { db, userId: userA });
    expect(full.content).toBe('v2 body');
    expect(full.revisions.map(r => r.version).sort()).toEqual([1, 2]);

    const v1 = await runTool('get_spec_revision', { id: spec.id, version: 1 }, { db, userId: userA });
    expect(v1.content).toBe('v1 body');
  }, 30000);

  it('update_spec title-only does not bump the version', async () => {
    const spec = await runTool('create_spec', {
      title: 'Title only', content: 'stable', task: taskA.id,
    }, { db, userId: userA });
    const updated = await runTool('update_spec', { id: spec.id, title: 'Renamed' }, { db, userId: userA });
    expect(updated.title).toBe('Renamed');
    expect(updated.version).toBe(1);
  }, 30000);

  it('get_task surfaces task-level and inherited workstream specs', async () => {
    const ws = await runTool('create_workstream', { label: `Inherit ${createId()}` }, { db, userId: userA });
    const task = await runTool('create_task', { title: 'Inheritor', workstream: ws.id }, { db, userId: userA });
    await runTool('create_spec', { title: 'stream-level', content: 'a', workstream: ws.id }, { db, userId: userA });
    await runTool('create_spec', { title: 'task-level', content: 'b', task: task.id }, { db, userId: userA });

    const got = await runTool('get_task', { id: task.id }, { db, userId: userA });
    expect(Array.isArray(got.specs)).toBe(true);
    const scopes = got.specs.map(s => s.scope).sort();
    expect(scopes).toEqual(['task', 'workstream']);
  }, 30000);

  it("a second user cannot read another user's spec", async () => {
    const secret = await runTool('create_spec', {
      title: 'secret', content: 'classified', task: taskA.id,
    }, { db, userId: userA });

    let err;
    try {
      await runTool('get_spec', { id: secret.id }, { db, userId: userB });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/spec not found/i);

    const visibleToB = await runTool('list_specs', {}, { db, userId: userB });
    expect(visibleToB.find(s => s.id === secret.id)).toBeUndefined();
  }, 30000);

  it('delete_spec removes the spec and its revisions', async () => {
    const spec = await runTool('create_spec', { title: 'temp', content: 'x', task: taskA.id }, { db, userId: userA });
    const res = await runTool('delete_spec', { id: spec.id }, { db, userId: userA });
    expect(res.ok).toBe(true);

    let err;
    try {
      await runTool('get_spec', { id: spec.id }, { db, userId: userA });
    } catch (e) { err = e; }
    expect(err?.message).toMatch(/spec not found/i);
  }, 30000);
});
