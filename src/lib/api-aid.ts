/**
 * Browser client for the Request Help (charity aid) endpoints. Same error
 * shape as src/lib/api.ts: every function throws an ApiError whose message
 * says what to fix.
 */
import { ApiError } from './api';
import { emit } from './storage';
import type { AidAnswers, AidStatus } from './aid';

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
    if (res.status === 401 && typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
    if (res.status === 413)
      throw new ApiError(
        413,
        'Those files are too big to send together. Send fewer or smaller files.',
        {
          files: 'Those files are too big to send together. Send fewer or smaller files.',
        },
      );
    throw new ApiError(
      res.status,
      body.error ?? `Something went wrong (${res.status}).`,
      body.fields ?? {},
    );
  }
  return body as T;
}

/**
 * Phone photos run 3 to 8 MB. Shrink to 2000px JPEG so several fit in one
 * request. PDFs and anything the browser cannot draw go as they are.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  const MAX_EDGE = 2000;
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  try {
    if (typeof createImageBitmap !== 'function') return file;
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
    if (!out || out.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([out], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export interface AidListItem {
  id: string;
  ref: string;
  applicantType: string;
  status: AidStatus;
  contactName: string;
  orgName: string;
  urgency: string;
  awardCents: number | null;
  createdAt: string;
  documentCount: number;
}

export interface AidDocument {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
  url: string;
}

export interface AidDetail {
  id: string;
  ref: string;
  applicantType: string;
  status: AidStatus;
  contactName: string;
  email: string;
  phone: string;
  orgName: string;
  urgency: string;
  answers: Partial<AidAnswers>;
  awardCents: number | null;
  decisionNote: string;
  decidedBy: string | null;
  decidedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
  documents: AidDocument[];
}

export const aid = {
  /** Public. Sends the answers as JSON in `data` and the files alongside. */
  apply(answers: AidAnswers & { website?: string }, files: File[]) {
    const fd = new FormData();
    fd.append('data', JSON.stringify(answers));
    for (const f of files) fd.append('files', f, f.name);
    return call<{ ref: string; filesSaved: number; filesFailed: number }>('/api/aid/apply', {
      method: 'POST',
      body: fd,
    });
  },
  list: (status: AidStatus | '' = '') =>
    call<{ applications: AidListItem[] }>(`/api/aid${status ? `?status=${status}` : ''}`).then(
      (r) => r.applications,
    ),
  get: (id: string) =>
    call<{ application: AidDetail }>(`/api/aid/${id}`).then((r) => r.application),
  async decide(id: string, input: { status: AidStatus; award: string; decisionNote: string }) {
    const r = await call<{ application: AidDetail }>(`/api/aid/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    emit();
    return r.application;
  },
};
