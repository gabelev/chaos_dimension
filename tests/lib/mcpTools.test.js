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
import { TOOLS, runTool } from '../../src/lib/mcpTools.js';

// Recursively collect every string embedded in a drizzle SQL condition's
// chunk tree (this includes the values passed to eq(...) — wrapped in Param
// objects — alongside column/type noise, which is harmless: the workstream
// fake filter only keeps rows whose id/slug equals one of these strings).
function collectLiterals(cond, acc = [], seen = new Set()) {
  if (typeof cond === 'string') { acc.push(cond); return acc; }
  if (!cond || typeof cond !== 'object' || seen.has(cond)) return acc;
  seen.add(cond);
  for (const key of Object.keys(cond)) {
    if (key === 'decoder' || key === 'encoder') continue;
    collectLiterals(cond[key], acc, seen);
  }
  return acc;
}

function makeFakeDb({ workstreams = [], tasks = [], agents = [] } = {}) {
  // Simple fake — returns all rows for any select. Filters happen on the JS
  // side anyway, except workstream resolution which filters by id/slug here.
  const self = {
    select: () => ({
      from: (t) => {
        const tName = t?.[Symbol.for('drizzle:Name')] || t?.name || '';
        const allRows = tName === 'workstreams' ? workstreams : tName === 'tasks' ? tasks : agents;
        let rows = allRows;
        const chain = {
          where: (cond) => {
            // Workstream resolution filters by id-or-slug — honor it so
            // slug resolution can be exercised. Other tables ignore filters.
            if (tName === 'workstreams' && cond) {
              const lits = collectLiterals(cond);
              rows = allRows.filter((w) => lits.includes(w.id) || lits.includes(w.slug));
            }
            return chain;
          },
          orderBy: () => chain,
          limit: () => rows,
          then: (resolve) => resolve(rows),
          [Symbol.asyncIterator]: async function* () { yield* rows; },
        };
        // Make the chain awaitable (returns rows when awaited).
        return new Proxy(chain, {
          get(target, prop) {
            if (prop === 'then') return (resolve) => resolve(rows);
            return target[prop];
          },
        });
      },
    }),
    transaction: async (fn) => fn(self),
    execute: async () => ({ rows: [] }),
  };
  return self;
}

describe('mcpTools registry', () => {
  it('exposes the v1 tools', () => {
    const names = TOOLS.map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_workstreams',
        'create_workstream',
        'update_workstream',
        'delete_workstream',
        'list_tasks',
        'get_task',
        'create_task',
        'update_task',
        'claim_task',
        'report_progress',
      ])
    );
    expect(names).toHaveLength(10);
  });

  it('every tool has name, description, inputSchema, handler', () => {
    for (const tool of TOOLS) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeTruthy();
      expect(typeof tool.handler).toBe('function');
    }
  });
});

describe('list_workstreams tool', () => {
  it('returns rows from the workstreams table', async () => {
    const fake = makeFakeDb({
      workstreams: [{ id: 'legal-ai', label: 'Legal AI', color: '#8B0000', icon: '⚖️' }],
    });
    const out = await runTool('list_workstreams', {}, { db: fake, userId: 'test-user' });
    expect(out).toEqual([{ id: 'legal-ai', label: 'Legal AI', color: '#8B0000', icon: '⚖️' }]);
  });
});

describe('workstream slug resolution', () => {
  // A workstream with both an opaque cuid id and a human-readable slug.
  const ws = {
    id: 'abc123def456ghi789jkl012',
    label: 'Chaos Dimension',
    slug: 'chaos-dimension',
    color: '#000',
    icon: '🌀',
  };

  it('create_task accepts a workstream slug and resolves it to the id', async () => {
    let inserted;
    const fake = makeFakeDb({ workstreams: [ws] });
    fake.insert = () => ({
      values: (v) => {
        inserted = v;
        return { returning: async () => [{ id: 'task-1', ...v }] };
      },
    });
    const out = await runTool(
      'create_task',
      { title: 'New task', workstream: 'chaos-dimension' },
      { db: fake, userId: 'test-user' },
    );
    expect(inserted.workstream).toBe(ws.id);
    expect(out.workstream).toBe(ws.id);
  });

  it('create_task accepts a workstream cuid id directly', async () => {
    let inserted;
    const fake = makeFakeDb({ workstreams: [ws] });
    fake.insert = () => ({
      values: (v) => {
        inserted = v;
        return { returning: async () => [{ id: 'task-1', ...v }] };
      },
    });
    await runTool(
      'create_task',
      { title: 'New task', workstream: ws.id },
      { db: fake, userId: 'test-user' },
    );
    expect(inserted.workstream).toBe(ws.id);
  });

  it('create_task stamps createdVia="mcp" on the inserted row', async () => {
    let inserted;
    const fake = makeFakeDb({ workstreams: [ws] });
    fake.insert = () => ({
      values: (v) => {
        inserted = v;
        return { returning: async () => [{ id: 'task-1', ...v }] };
      },
    });
    await runTool(
      'create_task',
      { title: 'New task', workstream: ws.id },
      { db: fake, userId: 'test-user' },
    );
    expect(inserted.createdVia).toBe('mcp');
  });

  it('create_task throws on an unknown workstream', async () => {
    const fake = makeFakeDb({ workstreams: [ws] });
    await expect(
      runTool(
        'create_task',
        { title: 'New task', workstream: 'does-not-exist' },
        { db: fake, userId: 'test-user' },
      ),
    ).rejects.toThrow('unknown workstream: does-not-exist');
  });

  it('list_tasks accepts a workstream slug', async () => {
    const fake = makeFakeDb({
      workstreams: [ws],
      tasks: [{ id: 'task-1', title: 'T', workstream: ws.id, column: 'backlog' }],
    });
    const out = await runTool(
      'list_tasks',
      { workstream: 'chaos-dimension' },
      { db: fake, userId: 'test-user' },
    );
    expect(out).toHaveLength(1);
    expect(out[0].workstream).toBe(ws.id);
  });

  it('list_tasks returns an empty list for an unknown workstream filter', async () => {
    const fake = makeFakeDb({
      workstreams: [ws],
      tasks: [{ id: 'task-1', title: 'T', workstream: ws.id, column: 'backlog' }],
    });
    const out = await runTool(
      'list_tasks',
      { workstream: 'does-not-exist' },
      { db: fake, userId: 'test-user' },
    );
    expect(out).toEqual([]);
  });
});
