import { describe, it, expect } from 'vitest';
import { TOOLS, runTool } from '../../src/lib/mcpTools.js';

function makeFakeDb({ workstreams = [], tasks = [], agents = [] } = {}) {
  const table = (name) => ({
    select: () => ({
      from: (t) => ({
        where: () => ({
          orderBy: () => ({
            limit: () => name === 'workstreams' ? workstreams : name === 'tasks' ? tasks : agents,
          }),
          limit: () => name === 'workstreams' ? workstreams : name === 'tasks' ? tasks : agents,
        }),
        orderBy: () => ({
          limit: () => name === 'workstreams' ? workstreams : name === 'tasks' ? tasks : agents,
        }),
      }),
    }),
  });
  // Simple fake — returns all rows for any select. Filters happen on the JS side anyway.
  return {
    select: () => ({
      from: (t) => {
        const tName = t?.[Symbol.for('drizzle:Name')] || t?.name || '';
        const rows = tName === 'workstreams' ? workstreams : tName === 'tasks' ? tasks : agents;
        const chain = {
          where: () => chain,
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
  };
}

describe('mcpTools registry', () => {
  it.skip('exposes the v1 tools', () => {
    const names = TOOLS.map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_workstreams',
        'list_tasks',
        'get_task',
        'create_task',
        'update_task',
        'claim_task',
        'report_progress',
      ])
    );
    expect(names).toHaveLength(7);
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
    const out = await runTool('list_workstreams', {}, { db: fake });
    expect(out).toEqual([{ id: 'legal-ai', label: 'Legal AI', color: '#8B0000', icon: '⚖️' }]);
  });
});
