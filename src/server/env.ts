/**
 * Typed access to environment variables. Works in Astro server routes, at
 * build time, and inside netlify/functions (which only see process.env).
 * Secrets never reach the browser: nothing here is imported by an island.
 */
type Meta = { env?: Record<string, string | undefined> };

function read(name: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (fromProcess !== undefined && fromProcess !== '') return fromProcess;
  const meta = (import.meta as unknown as Meta).env;
  const v = meta?.[name];
  return v === '' ? undefined : v;
}

export function env(name: string): string | undefined {
  return read(name);
}

export function requireEnv(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return v;
}

export const isProduction = () =>
  read('CONTEXT') === 'production' || read('NODE_ENV') === 'production';

export const siteUrl = () =>
  (read('PUBLIC_SITE_URL') ?? 'http://localhost:8888').replace(/\/$/, '');
