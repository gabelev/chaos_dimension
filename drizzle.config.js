// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import dotenv from 'dotenv';

// .env.local wins (developer overrides), .env is the committed default.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export default {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // drizzle-kit issues DDL. Resolution order:
    //   TEST_DATABASE_URL_MIGRATIONS — local dev pushes go to the Neon test
    //     branch by default, so a stray `npm run db:push` can't touch prod.
    //   DATABASE_URL_MIGRATIONS — explicit prod migration (set on CI or
    //     a deliberate local override; otherwise stays out of the way).
    //   DATABASE_URL — fallback for a fresh self-host before the
    //     two-role split is configured.
    url:
      process.env.TEST_DATABASE_URL_MIGRATIONS
      || process.env.DATABASE_URL_MIGRATIONS
      || process.env.DATABASE_URL,
  },
};
