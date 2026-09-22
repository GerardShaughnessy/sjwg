import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { env } from '../env';

/**
 * One Drizzle client over Neon's HTTP driver. No sockets, so it works in the
 * Netlify function, in netlify/functions, and during `astro build`.
 * Created lazily so a build without DATABASE_URL can still fall back to seed data.
 */
let cached: ReturnType<typeof make> | null = null;

function make() {
  const url = env('DATABASE_URL');
  if (!url) throw new Error('DATABASE_URL is not set');
  return drizzle(neon(url), { schema, casing: 'snake_case' });
}

export function db() {
  if (!cached) cached = make();
  return cached;
}

export const hasDatabase = () => Boolean(env('DATABASE_URL'));

export type Db = ReturnType<typeof db>;
export { schema };
