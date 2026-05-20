import dotenv from 'dotenv';

// .env.local wins (developer overrides), .env is the committed default.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export default {
  schema: './src/db/schema.js',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
