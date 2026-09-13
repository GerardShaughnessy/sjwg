/**
 * SSR-safe wrappers for localStorage and sessionStorage, plus a tiny change
 * bus so React islands can re-render when the store writes.
 */
const PREFIX = 'sjwg:v1:';

export const KEYS = {
  welcome: `${PREFIX}welcome-dismissed`,
  session: `${PREFIX}session`,
  requests: `${PREFIX}requests`,
  requestDraft: `${PREFIX}request-draft`,
  postDrafts: `${PREFIX}post-drafts`,
  profileOverrides: `${PREFIX}profile-overrides`,
  reminders: `${PREFIX}reminders`,
  formSubmissions: `${PREFIX}form-submissions`,
} as const;

export const canUseDom = () => typeof window !== 'undefined' && typeof document !== 'undefined';

function area(kind: 'local' | 'session'): Storage | null {
  if (!canUseDom()) return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getJSON<T>(key: string, fallback: T, kind: 'local' | 'session' = 'local'): T {
  const s = area(kind);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T, kind: 'local' | 'session' = 'local'): void {
  const s = area(kind);
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: state stays in memory for this page only */
  }
  emit();
}

export function removeKey(key: string, kind: 'local' | 'session' = 'local'): void {
  const s = area(kind);
  if (!s) return;
  try {
    s.removeItem(key);
  } catch {
    /* ignore */
  }
  emit();
}

/* Change bus. Version bumps on every write and on cross-tab storage events. */
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

if (canUseDom()) {
  window.addEventListener('storage', (e) => {
    if (e.key == null || e.key.startsWith(PREFIX)) emit();
  });
}
