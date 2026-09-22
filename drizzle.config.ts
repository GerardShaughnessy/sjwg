import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/** Migrations are generated and applied from a laptop, never inside a Netlify build. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
