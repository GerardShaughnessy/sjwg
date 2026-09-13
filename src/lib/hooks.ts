import { useEffect, useState, useSyncExternalStore } from 'react';
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
