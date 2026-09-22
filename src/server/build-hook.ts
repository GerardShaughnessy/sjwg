import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { settings } from './db/schema';
import { env } from './env';

/** Public pages are prerendered, so a content change needs a rebuild. Coalesced to one every few minutes. */
export const REBUILD_MIN_INTERVAL_MS = 3 * 60 * 1000;

async function getSetting<T>(key: string): Promise<T | null> {
  const [row] = await db().select().from(settings).where(eq(settings.key, key)).limit(1);
  return (row?.value as T) ?? null;
}

async function setSetting(key: string, value: unknown) {
  await db()
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export type RebuildOutcome = 'triggered' | 'coalesced' | 'no-hook';

/**
 * Ask Netlify to rebuild. If a build was requested in the last few minutes,
 * mark it pending instead; the hourly function picks it up.
 */
export async function requestRebuild(reason: string): Promise<RebuildOutcome> {
  const hook = env('NETLIFY_BUILD_HOOK_URL');
  const last = await getSetting<string>('last_build_requested_at');
  const recent = last ? Date.now() - Date.parse(last) < REBUILD_MIN_INTERVAL_MS : false;
  if (!hook) {
    await setSetting('rebuild_pending', { pending: true, reason, at: new Date().toISOString() });
    console.warn(`[build] no NETLIFY_BUILD_HOOK_URL; marked pending (${reason})`);
    return 'no-hook';
  }
  if (recent) {
    await setSetting('rebuild_pending', { pending: true, reason, at: new Date().toISOString() });
    return 'coalesced';
  }
  return fireHook(hook, reason);
}

export async function fireHook(hook: string, reason: string): Promise<RebuildOutcome> {
  try {
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trigger_title: reason }),
    });
    if (!res.ok) throw new Error(`build hook ${res.status}`);
    await setSetting('last_build_requested_at', new Date().toISOString());
    await setSetting('rebuild_pending', { pending: false });
    return 'triggered';
  } catch (err) {
    console.error('[build] hook failed', err);
    await setSetting('rebuild_pending', { pending: true, reason, at: new Date().toISOString() });
    return 'coalesced';
  }
}

/** Used by the scheduled function. */
export async function flushPendingRebuild(): Promise<RebuildOutcome | 'nothing'> {
  const pending = await getSetting<{ pending?: boolean; reason?: string }>('rebuild_pending');
  if (!pending?.pending) return 'nothing';
  const hook = env('NETLIFY_BUILD_HOOK_URL');
  if (!hook) return 'no-hook';
  return fireHook(hook, pending.reason ?? 'pending content change');
}
