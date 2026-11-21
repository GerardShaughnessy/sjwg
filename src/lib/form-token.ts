import { useCallback, useEffect, useRef } from 'react';

/** The server refuses a token younger than this (FORM_TOKEN_MIN_MS), plus a margin. */
const MIN_AGE_MS = 3_000 + 250;
/** Refetch a token close to the server's two-hour limit (FORM_TOKEN_MAX_MS). */
const STALE_MS = 110 * 60 * 1000;

type Held = { token: string; at: number };

async function fetchToken(form: string): Promise<Held | null> {
  try {
    const r = await fetch(`/api/form-token/${form}`);
    if (!r.ok) return null;
    const b = (await r.json()) as { token?: string };
    return b?.token ? { token: b.token, at: Date.now() } : null;
  } catch {
    return null;
  }
}

/**
 * Fetches a signed spam-check token when a public form opens. The server
 * refuses submissions that come back too fast or without one. Call `ensure()`
 * when the form submits: if the first fetch failed it fetches again, and if the
 * token is near expiry it fetches a new one; if the
 * token is fresh it waits out the rest of the minimum age, so a person never
 * sees "too fast" and never loses a filled form.
 */
export function useFormToken(form: 'directory' | 'aid') {
  const held = useRef<Held | null>(null);
  useEffect(() => {
    void fetchToken(form).then((h) => {
      if (h && !held.current) held.current = h;
    });
  }, [form]);
  const ensure = useCallback(async (): Promise<string> => {
    if (!held.current || Date.now() - held.current.at > STALE_MS)
      held.current = (await fetchToken(form)) ?? held.current;
    const h = held.current;
    if (!h) return '';
    const wait = MIN_AGE_MS - (Date.now() - h.at);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return h.token;
  }, [form]);
  return { ensure };
}
