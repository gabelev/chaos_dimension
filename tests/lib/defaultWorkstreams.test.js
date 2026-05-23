import { describe, it, expect, vi } from 'vitest';
import { seedDefaultWorkstreams, DEFAULT_WORKSTREAM_LABELS } from '../../src/lib/defaultWorkstreams.js';

function makeTx() {
  const rows = [];
  return {
    rows,
    insert: () => ({
      values: async (rs) => {
        for (const r of rs) rows.push(r);
        return rs;
      },
    }),
  };
}

describe('seedDefaultWorkstreams', () => {
  it('inserts five starter workstreams stamped with the given userId', async () => {
    const tx = makeTx();
    const userId = 'user-abc';
    const inserted = await seedDefaultWorkstreams(tx, userId);
    expect(inserted).toHaveLength(5);
    expect(tx.rows).toHaveLength(5);
    for (const r of tx.rows) {
      expect(r.userId).toBe(userId);
      expect(r.id).toMatch(/^[a-z0-9]{24}$/);
      expect(r.slug).toBeTruthy();
      expect(r.label).toBeTruthy();
    }
  });

  it('uses distinct cuid ids for each row', async () => {
    const tx = makeTx();
    await seedDefaultWorkstreams(tx, 'user-abc');
    const ids = new Set(tx.rows.map((r) => r.id));
    expect(ids.size).toBe(5);
  });

  it('uses distinct slugs (one per starter label)', async () => {
    const tx = makeTx();
    await seedDefaultWorkstreams(tx, 'user-abc');
    const slugs = new Set(tx.rows.map((r) => r.slug));
    expect(slugs.size).toBe(5);
  });

  it('throws if userId is falsy', async () => {
    const tx = makeTx();
    await expect(seedDefaultWorkstreams(tx, null)).rejects.toThrow(/userId required/);
    await expect(seedDefaultWorkstreams(tx, '')).rejects.toThrow(/userId required/);
  });

  it('exposes DEFAULT_WORKSTREAM_LABELS for docs / tests', () => {
    expect(DEFAULT_WORKSTREAM_LABELS).toEqual(['Research', 'Studio', 'Writing', 'Build', 'Practice']);
  });
});
