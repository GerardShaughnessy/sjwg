/**
 * The browser's view of the server. Same namespaces and function names the
 * mockup's store had, so portal components change as little as possible.
 * Every function throws an ApiError whose message says what to fix.
 */
import type { GuildEvent, Member, RequestAnswers, RequestStatus, Urgency } from './types';
import { emit } from './storage';
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
    if (res.status === 401 && typeof window !== 'undefined') {
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

/** Writes bump the change bus so `useResource` consumers refetch. */
async function mutate<T>(path: string, init: RequestInit): Promise<T> {
  const out = await call<T>(path, init);
  emit();
  return out;
}

export type Rebuild = 'triggered' | 'coalesced' | 'no-hook' | null;

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

export interface RequestView {
  id: string;
  ref: string;
  createdAt: string;
  status: RequestStatus;
  trade: string;
  tradeSlug: string;
  description: string;
  urgency: Urgency;
  zip: string;
  neighborhood: string;
  contact: { name: string; phone: string; email: string; bestTime: string };
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  notes: string | null;
  photos: { id: string; url: string }[];
  noteCount: number;
  source: string;
}

export interface RequestNote {
  id: string;
  authorKind: 'requester' | 'member';
  authorName: string | null;
  body: string;
  visibleToRequester: boolean;
  createdAt: string;
}

export interface RequestEvent {
  id: string;
  actorKind: 'requester' | 'member' | 'system';
  actorName: string | null;
  action: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export const requests = {
  /** Public. The photo is downsized in the browser and sent as base64 JSON. */
  async create(answers: RequestAnswers, photo: File | null): Promise<CreatedRequest> {
    const { photoName: _drop, ...rest } = answers;
    const encoded = photo ? await encodePhoto(photo) : null;
    return call<CreatedRequest>('/api/requests', json('POST', { answers: rest, photo: encoded }));
  },
  list: (status: RequestStatus | 'active' | 'all' = 'active') =>
    call<{ requests: RequestView[] }>(
      `/api/requests?status=${status === 'all' ? '' : status}`,
    ).then((r) => r.requests),
  claim: (id: string) =>
    mutate<{ id: string; status: RequestStatus }>(`/api/requests/${id}/claim`, json('POST', {})),
  refer: (id: string, input: { memberId?: string | null; note?: string }) =>
    mutate<{ id: string; status: RequestStatus; emailed: boolean; hasEmail: boolean | null }>(
      `/api/requests/${id}/refer`,
      json('POST', input),
    ),
  close: (id: string) =>
    mutate<{ id: string; status: RequestStatus }>(`/api/requests/${id}/close`, json('POST', {})),
  reopen: (id: string) =>
    mutate<{ id: string; status: RequestStatus }>(`/api/requests/${id}/reopen`, json('POST', {})),
  history: (id: string) =>
    call<{ notes: RequestNote[]; events: RequestEvent[] }>(`/api/requests/${id}/notes`),
  addNote: (id: string, body: string, visibleToRequester: boolean) =>
    mutate<{ note: RequestNote; emailed: boolean }>(
      `/api/requests/${id}/notes`,
      json('POST', { body, visibleToRequester }),
    ),
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
  return { name: file.name, dataBase64: await toBase64(blob) };
}

export async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
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
  status: RequestStatus;
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

/* --------------------------------------------------------------------- me */
export interface ReminderPrefs {
  email: boolean;
  sms: boolean;
  phone: string;
}

export const me = {
  get: () => call<{ session: unknown; member: Member | null }>('/api/me'),
  updateProfile: (patch: Omit<Member, 'id' | 'photo' | 'featured'> & { public: boolean }) =>
    mutate<{ member: Member; rebuild: Rebuild }>('/api/me/profile', json('PUT', patch)),
};

export const reminders = {
  get: () => call<{ prefs: ReminderPrefs }>('/api/me/reminders').then((r) => r.prefs),
  save: (prefs: ReminderPrefs) =>
    mutate<{ prefs: ReminderPrefs }>('/api/me/reminders', json('PUT', prefs)).then((r) => r.prefs),
};

/* ------------------------------------------------------------------ posts */
export interface PostView {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  authorName: string;
  authorUserId: string | null;
  status: 'draft' | 'published';
  pubDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const posts = {
  list: () => call<{ posts: PostView[] }>('/api/posts').then((r) => r.posts),
  save: (draft: { id?: string; title: string; description?: string; body: string }) =>
    mutate<{ post: PostView; rebuild?: Rebuild }>(
      draft.id ? `/api/posts/${draft.id}` : '/api/posts',
      json(draft.id ? 'PUT' : 'POST', {
        title: draft.title,
        description: draft.description ?? '',
        bodyMd: draft.body,
      }),
    ).then((r) => r.post),
  remove: (id: string) => mutate<{ ok: true }>(`/api/posts/${id}`, { method: 'DELETE' }),
  publish: (id: string, publish = true) =>
    mutate<{ post: PostView; rebuild: Rebuild }>(
      `/api/posts/${id}/publish`,
      json('POST', { publish }),
    ),
};

/* ----------------------------------------------------------------- events */
export type EventInput = Omit<GuildEvent, 'id' | 'slug'> & { published: boolean };

export const events = {
  list: () =>
    call<{ events: (GuildEvent & { published: boolean })[] }>('/api/events').then((r) => r.events),
  create: (input: EventInput) =>
    mutate<{ event: GuildEvent; rebuild: Rebuild }>('/api/events', json('POST', input)),
  update: (id: string, input: EventInput) =>
    mutate<{ event: GuildEvent; rebuild: Rebuild }>(`/api/events/${id}`, json('PUT', input)),
  remove: (id: string) =>
    mutate<{ ok: true; rebuild: Rebuild }>(`/api/events/${id}`, { method: 'DELETE' }),
};

/* --------------------------------------------------------------- sponsors */
export interface Sponsor {
  id: string;
  name: string;
  url: string;
  tier: 'partner' | 'sponsor' | 'supporter' | 'in-kind';
  logo: string | null;
  logoAlt: string;
  active: boolean;
  sortOrder: number;
}
export type SponsorInput = Omit<Sponsor, 'id' | 'logo'>;

export const sponsors = {
  list: () => call<{ sponsors: Sponsor[] }>('/api/sponsors').then((r) => r.sponsors),
  create: (input: SponsorInput) =>
    mutate<{ sponsor: Sponsor; rebuild: Rebuild }>('/api/sponsors', json('POST', input)),
  update: (id: string, input: SponsorInput) =>
    mutate<{ sponsor: Sponsor; rebuild: Rebuild }>(`/api/sponsors/${id}`, json('PUT', input)),
  remove: (id: string) =>
    mutate<{ ok: true; rebuild: Rebuild }>(`/api/sponsors/${id}`, { method: 'DELETE' }),
  async uploadLogo(id: string, file: File) {
    return mutate<{ sponsor: Sponsor; rebuild: Rebuild }>(
      `/api/sponsors/${id}/logo`,
      json('POST', { name: file.name, dataBase64: await toBase64(file) }),
    );
  },
};

/* -------------------------------------------------------------- donations */
export interface DonationView {
  id: string;
  date: string;
  donorName: string;
  donorEmail: string;
  amount: number;
  amountCents: number;
  method: 'card' | 'check' | 'cash' | 'ach' | 'other';
  fund: string;
  tier: string;
  recurring: boolean;
  ackStatus: 'not_required' | 'pending_review' | 'sent' | 'manual';
  note: string;
  stripe: boolean;
}
export interface ManualDonation {
  donorName: string;
  donorEmail: string;
  amountCents: number;
  method: DonationView['method'];
  fund: string;
  tier: string;
  recurring: boolean;
  receivedAt: string;
  note: string;
}

export const donations = {
  list: () => call<{ donations: DonationView[] }>('/api/donations').then((r) => r.donations),
  add: (input: ManualDonation) =>
    mutate<{ donation: DonationView }>('/api/donations', json('POST', input)),
  patch: (id: string, patch: { ackStatus?: DonationView['ackStatus']; note?: string }) =>
    mutate<{ donation: DonationView }>(`/api/donations/${id}`, json('PUT', patch)),
  remove: (id: string) => mutate<{ ok: true }>(`/api/donations/${id}`, { method: 'DELETE' }),
  csvUrl: '/api/donations/export.csv',
};

/* ------------------------------------------------------------ invitations */
export interface InvitationView {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  memberId: string | null;
  memberName: string | null;
  invitedBy: string | null;
  expiresAt: string;
  openedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  state: 'pending' | 'accepted' | 'expired';
}
export interface InvitationResult {
  id: string;
  email: string;
  emailed: boolean;
  mailError: string | null;
  link: string;
}

export const invitations = {
  list: () =>
    call<{ invitations: InvitationView[] }>('/api/invitations').then((r) => r.invitations),
  create: (input: {
    email: string;
    name: string;
    role: 'admin' | 'member';
    memberId?: string | null;
  }) => mutate<InvitationResult>('/api/invitations', json('POST', input)),
  resend: (id: string) =>
    mutate<InvitationResult>(`/api/invitations/${id}/resend`, json('POST', {})),
  revoke: (id: string) => mutate<{ ok: true }>(`/api/invitations/${id}`, { method: 'DELETE' }),
  complete: (token: string) =>
    call<{ ok: true; role: string }>('/api/invitations/complete', json('POST', { token })),
};

/* ---------------------------------------------------------------- members */
export interface MemberAdmin extends Member {
  public: boolean;
  sortOrder: number;
  privatePhone: string;
  privateEmail: string;
  sample: boolean;
  accountEmail: string | null;
}
export type MemberInput = Omit<MemberAdmin, 'id' | 'photo' | 'sample' | 'accountEmail'>;
export interface MemberBrief {
  id: string;
  name: string;
  trade: string;
  public: boolean;
}

export const members = {
  /** Officers get MemberAdmin rows; members get MemberBrief rows. */
  list: () =>
    call<{ members: (MemberAdmin | MemberBrief)[] }>('/api/members').then((r) => r.members),
  create: (input: MemberInput) =>
    mutate<{ member: MemberAdmin; rebuild: Rebuild }>('/api/members', json('POST', input)),
  update: (id: string, input: MemberInput) =>
    mutate<{ member: MemberAdmin; rebuild: Rebuild }>(`/api/members/${id}`, json('PUT', input)),
  remove: (id: string) =>
    mutate<{ ok: true; rebuild: Rebuild }>(`/api/members/${id}`, { method: 'DELETE' }),
  async uploadPhoto(id: string, file: File) {
    const encoded = await encodePhoto(file);
    return mutate<{ member: MemberAdmin; rebuild: Rebuild }>(
      `/api/members/${id}/photo`,
      json('POST', encoded),
    );
  },
  removePhoto: (id: string) =>
    mutate<{ member: MemberAdmin; rebuild: Rebuild }>(`/api/members/${id}/photo`, {
      method: 'DELETE',
    }),
};

/* ---------------------------------------------------------- announcements */
export const announcements = {
  send: (input: { subject: string; body: string }) =>
    call<{ recipients: number; sent: number; failed: string[] }>(
      '/api/announcements',
      json('POST', input),
    ),
};
