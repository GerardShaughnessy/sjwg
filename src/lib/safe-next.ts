/**
 * Where a `?next=` may send someone after logging in: a same-site path under
 * /portal or /sign. Anything else (another site, `//host`, a backslash trick,
 * /api, control characters) gives null so the caller falls back to /portal.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2000) return null;
  // Control characters and backslashes: browsers fold `\` into `/`, so `/\host` is off-site.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(raw, 'https://same.site');
  } catch {
    return null;
  }
  if (url.origin !== 'https://same.site') return null;
  if (!/^\/(portal|sign)(\/|$)/.test(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}
