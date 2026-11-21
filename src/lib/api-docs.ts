/**
 * Browser client for tradesman documents and e-signature. Same pattern as
 * api.ts: every function throws an ApiError whose message says what to fix,
 * and writes bump the change bus so useResource consumers refetch.
 */
import { ApiError } from './api';
import { emit } from './storage';

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
    throw new ApiError(
      res.status,
      body.error ??
        (res.status === 413
          ? 'That file is too big to send. Keep it under 4 MB. A phone photo or a scanned PDF usually is.'
          : `Something went wrong (${res.status}).`),
      body.fields ?? {},
    );
  }
  return body as T;
}

async function mutate<T>(path: string, init: RequestInit): Promise<T> {
  const out = await call<T>(path, init);
  emit();
  return out;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

/* -------------------------------------------------------------- documents */
export type DocStatus = 'pending' | 'verified' | 'rejected';
export interface MemberDoc {
  id: string;
  memberId: string;
  kind: string;
  kindLabel: string;
  filename: string;
  contentType: string;
  byteSize: number;
  status: DocStatus;
  note: string;
  expiresOn: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  fileUrl: string;
}
export interface DocMember {
  id: string;
  name: string;
  trade: string;
}

export const docs = {
  mine: () => call<{ documents: MemberDoc[]; hasMember: boolean }>('/api/documents'),
  all: () =>
    call<{ documents: MemberDoc[]; members: DocMember[]; pledgeSigned: string[] }>(
      '/api/documents',
    ),
  upload: (input: { file: File; kind: string; expiresOn?: string; memberId?: string }) => {
    const form = new FormData();
    form.set('file', input.file);
    form.set('kind', input.kind);
    if (input.expiresOn) form.set('expiresOn', input.expiresOn);
    if (input.memberId) form.set('memberId', input.memberId);
    return mutate<{ document: MemberDoc }>('/api/documents', { method: 'POST', body: form });
  },
  review: (id: string, patch: { status?: DocStatus; note?: string; expiresOn?: string | null }) =>
    mutate<{ document: MemberDoc }>(`/api/documents/${id}`, json('PATCH', patch)),
  remove: (id: string) => mutate<{ ok: true }>(`/api/documents/${id}`, { method: 'DELETE' }),
};

/* ------------------------------------------------------------ e-signature */
export type SignStatus = 'sent' | 'viewed' | 'signed' | 'voided';
export interface SignRequestView {
  id: string;
  docKind: string;
  docLabel: string;
  title: string;
  signerName: string;
  signerEmail: string;
  memberId: string | null;
  status: SignStatus;
  sentByName: string;
  sentAt: string;
  viewedAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  voidedAt: string | null;
  expiresAt: string;
  expired: boolean;
  hasPdf: boolean;
}
export interface SendResult {
  request: SignRequestView;
  emailed: boolean;
  mailError: string | null;
  link: string;
}

export const signing = {
  list: () => call<{ requests: SignRequestView[] }>('/api/sign/requests').then((r) => r.requests),
  mine: () => call<{ requests: SignRequestView[] }>('/api/sign/mine').then((r) => r.requests),
  send: (input: { docKind: string; memberId?: string | null; name: string; email: string }) =>
    mutate<SendResult>('/api/sign/requests', json('POST', input)),
  resend: (id: string) => mutate<SendResult>(`/api/sign/requests/${id}/resend`, json('POST', {})),
  void: (id: string) =>
    mutate<{ request: SignRequestView }>(`/api/sign/requests/${id}/void`, json('POST', {})),
  pdfUrl: (id: string) => `/api/sign/requests/${id}/pdf`,
};
