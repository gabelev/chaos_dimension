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
import { checkRateLimit } from '../../src/lib/oauthRateLimit.js';

function fakeDb(initialRows = []) {
  const rows = [...initialRows];
  return {
    rows,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows.slice(0, 1),
        }),
      }),
    }),
    insert: () => ({
      values: (v) => ({
        returning: async () => { rows.push({ id: `r-${rows.length}`, ...v }); return [rows[rows.length - 1]]; },
      }),
    }),
    update: () => ({ set: (patch) => ({ where: async () => { if (rows[0]) Object.assign(rows[0], patch); } }) }),
  };
}

describe('checkRateLimit', () => {
  it('allows the first request and creates a window row', async () => {
    const db = fakeDb();
    const res = await checkRateLimit(db, { bucket: 'register:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(res.allowed).toBe(true);
    expect(db.rows.length).toBe(1);
    expect(db.rows[0].count).toBe(1);
  });

  it('denies once over the limit', async () => {
    const db = fakeDb([{ id: 'r0', bucket: 'register:1.2.3.4', windowStart: new Date(), count: 5 }]);
    const res = await checkRateLimit(db, { bucket: 'register:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(res.allowed).toBe(false);
  });

  it('resets when the window has elapsed', async () => {
    const db = fakeDb([{ id: 'r0', bucket: 'register:1.2.3.4', windowStart: new Date(Date.now() - 70_000), count: 100 }]);
    const res = await checkRateLimit(db, { bucket: 'register:1.2.3.4', limit: 5, windowSeconds: 60 });
    expect(res.allowed).toBe(true);
    expect(db.rows[0].count).toBe(1);
  });
});
