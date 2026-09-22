/**
 * The browser's view of the server. Same namespaces and function names the
 * mockup's store had, so portal components change as little as possible.
 * Every function throws an ApiError whose message says what to fix.
 */
import type { RequestAnswers } from './types';
export { subscribe, getVersion } from './storage';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(0, 'Could not reach the Guild. Check your connection and try again.');
  }
  const text = await res.text();
  let body: { error?: string; fields?: Record<string, string> } & Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    if (res.status === 401) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
    throw new ApiError(
      res.status,
      body.error ?? `Something went wrong (${res.status}).`,
      body.fields ?? {},
    );
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

/* --------------------------------------------------------------- requests */
export interface CreatedRequest {
  id: string;
  ref: string;
  status: string;
  createdAt: string;
  trackingUrl: string;
  confirmationSent: boolean;
  photoCount: number;
}

export const requests = {
  /** Public. The photo is downsized in the browser and sent as base64 JSON. */
  async create(answers: RequestAnswers, photo: File | null): Promise<CreatedRequest> {
    const { photoName: _drop, ...rest } = answers;
    const encoded = photo ? await encodePhoto(photo) : null;
    return call<CreatedRequest>('/api/requests', json('POST', { answers: rest, photo: encoded }));
  },
};

/** Phones produce 3 to 8 MB photos. Downsize to 1600px JPEG so the upload is small and quick. */
export async function encodePhoto(file: File): Promise<{ name: string; dataBase64: string }> {
  const MAX_EDGE = 1600;
  let blob: Blob = file;
  try {
    if (
      typeof createImageBitmap === 'function' &&
      /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)
    ) {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (out && out.size < file.size) blob = out;
    }
  } catch {
    /* HEIC or an odd file: send as is, the server checks size and type */
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { name: file.name, dataBase64: btoa(bin) };
}

/* ------------------------------------------------------------------ track */
export interface TrackedNote {
  id: string;
  by: string;
  body: string;
  at: string;
}
export interface TrackedRequest {
  ref: string;
  status: 'open' | 'claimed' | 'referred' | 'closed';
  trade: string;
  description: string;
  urgency: string;
  zip: string;
  neighborhood: string;
  firstName: string;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
  notes: TrackedNote[];
  photos: { id: string; url: string }[];
}

export const track = {
  get: (token: string) => call<TrackedRequest>(`/api/track/${encodeURIComponent(token)}`),
  addNote: (token: string, body: string) =>
    call<{ note: TrackedNote }>(
      `/api/track/${encodeURIComponent(token)}/notes`,
      json('POST', { body }),
    ),
};

/* ------------------------------------------------------------------ forms */
export const forms = {
  submit: (kind: 'contact' | 'partner' | 'membership', payload: Record<string, string>) =>
    call<{ id: string }>(`/api/forms/${kind}`, json('POST', payload)),
};

/* ------------------------------------------------------------ invitations */
export const invitations = {
  complete: (token: string) =>
    call<{ ok: true; role: string }>('/api/invitations/complete', json('POST', { token })),
};
