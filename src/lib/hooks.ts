import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { subscribe, getVersion } from './storage';

/**
 * Re-renders the component whenever the store writes. The server snapshot
 * is a constant so client:load islands hydrate without a mismatch.
 */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}

/** True after mount. Storage-backed reads should wait for this in hydrated islands. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Load something from the API, re-run when the change bus bumps (any write
 * through api.ts) or when `deps` change. Keeps the old data on screen while
 * refetching so lists do not flicker.
 */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []): Resource<T> {
  const version = useStoreVersion();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setLoading(true);
    loader()
      .then((d) => {
        if (id !== latest.current) return;
        setData(d);
        setError(null);
      })
      .catch((err) => {
        if (id !== latest.current) return;
        setError(err instanceof Error ? err.message : 'Could not load.');
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}
