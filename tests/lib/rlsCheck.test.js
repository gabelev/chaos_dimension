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
import { getDb } from '../../src/db/client.js';
import { checkRlsState, assertRlsState, RLS_REQUIRED_TABLES } from '../../src/lib/rlsCheck.js';

const SKIP = !process.env.DATABASE_URL;
const describeMaybe = SKIP ? describe.skip : describe;

describeMaybe('checkRlsState against the live test branch', () => {
  it('returns no problems when RLS is healthy', async () => {
    const db = getDb();
    const problems = await checkRlsState(db);
    if (problems.length) {
      // Surface the specific problem in the test output so a regression
      // is immediately diagnosable rather than a generic "expected []".
      console.error('RLS state on test branch:', problems);
    }
    expect(problems).toEqual([]);
  });

  it('assertRlsState does not throw on a healthy DB', async () => {
    const db = getDb();
    await expect(assertRlsState(db)).resolves.toBeUndefined();
  });
});

describe('checkRlsState — synthetic failure modes (unit tests)', () => {
  // Tiny fake that returns whatever rows we hand it for each query type.
  // The function issues three queries in order: role, table state, policies.
  function fakeDb({ role, tableRows, policyRows }) {
    let call = 0;
    return {
      execute: async () => {
        call += 1;
        if (call === 1) return { rows: [role] };
        if (call === 2) return { rows: tableRows };
        return { rows: policyRows };
      },
    };
  }

  // Derived from the source-of-truth list so adding an RLS table doesn't
  // silently desync these fixtures (it did for the specs tables).
  const allPolicies = RLS_REQUIRED_TABLES.map((t) => ({
    tablename: t, policyname: `${t}_user_isolation`,
  }));
  const healthyTables = RLS_REQUIRED_TABLES.map((t) => ({
    relname: t, relrowsecurity: true, relforcerowsecurity: true,
  }));

  it('flags BYPASSRLS on the connection role', async () => {
    const db = fakeDb({
      role: { role: 'cd_app', bypassrls: true },
      tableRows: healthyTables,
      policyRows: allPolicies,
    });
    const problems = await checkRlsState(db);
    expect(problems.some((p) => /BYPASSRLS=true/.test(p))).toBe(true);
  });

  it('flags ENABLE=false (the prod leak shape)', async () => {
    const db = fakeDb({
      role: { role: 'cd_app', bypassrls: false },
      tableRows: healthyTables.map((t) => ({ ...t, relrowsecurity: false })),
      policyRows: allPolicies,
    });
    const problems = await checkRlsState(db);
    expect(problems.filter((p) => /row-level security is DISABLED/.test(p))).toHaveLength(RLS_REQUIRED_TABLES.length);
  });

  it('flags FORCE=false (owner-role bypass)', async () => {
    const db = fakeDb({
      role: { role: 'cd_app', bypassrls: false },
      tableRows: healthyTables.map((t) => ({ ...t, relforcerowsecurity: false })),
      policyRows: allPolicies,
    });
    const problems = await checkRlsState(db);
    expect(problems.filter((p) => /FORCE row-level security is OFF/.test(p))).toHaveLength(RLS_REQUIRED_TABLES.length);
  });

  it('flags missing policies', async () => {
    const db = fakeDb({
      role: { role: 'cd_app', bypassrls: false },
      tableRows: healthyTables,
      policyRows: [], // all policies dropped
    });
    const problems = await checkRlsState(db);
    expect(problems.filter((p) => /missing RLS policy/.test(p))).toHaveLength(RLS_REQUIRED_TABLES.length);
  });

  it('healthy state → empty problems', async () => {
    const db = fakeDb({
      role: { role: 'cd_app', bypassrls: false },
      tableRows: healthyTables,
      policyRows: allPolicies,
    });
    expect(await checkRlsState(db)).toEqual([]);
  });

  it('checkRole:false skips the role-bypass check (the migration owner-connection path)', async () => {
    // With checkRole:false the role query is not issued, so the first execute
    // is the table-state query and the second is policies. A BYPASSRLS owner
    // role must NOT be reported, but the schema checks still run.
    let call = 0;
    const db = {
      execute: async () => {
        call += 1;
        return call === 1 ? { rows: healthyTables } : { rows: allPolicies };
      },
    };
    const problems = await checkRlsState(db, { checkRole: false });
    expect(problems).toEqual([]);
    expect(problems.some((p) => /BYPASSRLS/.test(p))).toBe(false);
  });

  it('checkRole:false still flags missing schema state (RLS off)', async () => {
    let call = 0;
    const db = {
      execute: async () => {
        call += 1;
        return call === 1
          ? { rows: healthyTables.map((t) => ({ ...t, relrowsecurity: false })) }
          : { rows: allPolicies };
      },
    };
    const problems = await checkRlsState(db, { checkRole: false });
    expect(problems.filter((p) => /row-level security is DISABLED/.test(p))).toHaveLength(RLS_REQUIRED_TABLES.length);
  });
});
