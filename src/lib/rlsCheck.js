// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { sql } from 'drizzle-orm';

// Source of truth for which tables require RLS. The migration installs
// policies on exactly these tables, and verifyRlsState asserts the same.
export const RLS_REQUIRED_TABLES = ['tasks', 'workstreams', 'agents', 'runs', 'specs', 'spec_revisions'];

// Returns an array of human-readable problem strings. Empty array = healthy.
// Designed to run against a connection that can read pg_catalog / pg_policies
// (both cd_app and neondb_owner can; this is system metadata, not user data).
export async function checkRlsState(db) {
  const problems = [];

  // 1. The app role must NOT bypass RLS. If Neon re-elevated cd_app, every
  //    query returns every row regardless of policy — silent total leak.
  const role = await db.execute(sql`
    SELECT current_user AS role, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls
  `);
  const r = (role.rows ?? role)[0];
  if (r?.bypassrls) {
    problems.push(`connection role ${r.role} has BYPASSRLS=true; data isolation is bypassed at the role layer`);
  }

  // 2. RLS must be enabled AND forced on every scoped table. FORCE without
  //    ENABLE is inert; that exact state was the prod leak we hit on
  //    2026-05-23 (db:push wiped relrowsecurity but left relforcerowsecurity).
  //    Build the IN list from the hardcoded RLS_REQUIRED_TABLES (safe to
  //    interpolate; no user input).
  const inList = RLS_REQUIRED_TABLES.map((t) => `'${t}'`).join(', ');
  const tables = await db.execute(sql.raw(`
    SELECT relname, relrowsecurity, relforcerowsecurity
    FROM pg_class
    WHERE relname IN (${inList})
  `));
  const tableRows = tables.rows ?? tables;
  const seen = new Set();
  for (const row of tableRows) {
    seen.add(row.relname);
    if (!row.relrowsecurity) problems.push(`table ${row.relname}: row-level security is DISABLED (relrowsecurity=false)`);
    if (!row.relforcerowsecurity) problems.push(`table ${row.relname}: FORCE row-level security is OFF; owner-role queries bypass policies`);
  }
  for (const t of RLS_REQUIRED_TABLES) {
    if (!seen.has(t)) problems.push(`scoped table ${t} not found in pg_class — schema missing?`);
  }

  // 3. The isolation policy must exist on every scoped table. ENABLE without
  //    a policy is a permit-deny-all that breaks the app; ENABLE with the
  //    wrong policy could over-permit.
  const policies = await db.execute(sql.raw(`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE tablename IN (${inList})
  `));
  const policySet = new Set((policies.rows ?? policies).map((p) => `${p.tablename}:${p.policyname}`));
  for (const t of RLS_REQUIRED_TABLES) {
    const expected = `${t}:${t}_user_isolation`;
    if (!policySet.has(expected)) problems.push(`missing RLS policy ${t}_user_isolation on ${t}`);
  }

  return problems;
}

// Throws an Error listing every problem if state is unhealthy.
// Use this inside the migration's tx so any drift rolls the whole thing back.
export async function assertRlsState(db) {
  const problems = await checkRlsState(db);
  if (problems.length) {
    const msg = ['RLS state check failed:', ...problems.map((p) => `  - ${p}`)].join('\n');
    throw new Error(msg);
  }
}
