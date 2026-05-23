// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: false,
    // Run all test files in a single worker. Multiple live-DB tests
    // (oauth-e2e, migrate-multi-tenant, multi-tenant-isolation) all do
    // concurrent DDL/inserts on the same Neon test branch and can deadlock
    // when run in parallel. The serial pool adds a few seconds of runtime
    // but eliminates the race. Re-enable parallelism if/when live-DB tests
    // are isolated to their own ephemeral branches.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
