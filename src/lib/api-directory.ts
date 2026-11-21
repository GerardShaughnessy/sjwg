/** Browser client for the directory gate. Same error shape as src/lib/api.ts. */
import { ApiError } from './api';

export interface AffirmPayload {
  fullName: string;
  email: string;
  signedDate: string;
  catholic: 'catholic' | 'not-catholic' | '';
  alignmentNote: string;
  affirm: Record<string, boolean>;
  website: string;
}

async function post<T>(path: string, data: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the Guild. Check your connection and try again.');
  }
  let body: { error?: string; fields?: Record<string, string> } & Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok)
    throw new ApiError(
      res.status,
      body.error ?? `Something went wrong (${res.status}).`,
      body.fields ?? {},
    );
  return body as T;
}

export const directory = {
  affirm: (payload: AffirmPayload) => post<{ ok: true }>('/api/directory/affirm', payload),
};
