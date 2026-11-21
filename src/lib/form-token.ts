import { useEffect, useRef } from 'react';

/**
 * Fetches a signed spam-check token when a public form opens. The server
 * refuses submissions that come back too fast or without one.
 */
export function useFormToken(form: 'directory' | 'aid') {
  const token = useRef('');
  useEffect(() => {
    fetch(`/api/form-token/${form}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { token?: string } | null) => {
        if (b?.token) token.current = b.token;
      })
      .catch(() => {});
  }, [form]);
  return token;
}
