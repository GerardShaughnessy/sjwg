/** Pure session rules, kept apart from the auth server so tests need no database. */
export type Role = 'admin' | 'member';

/** What every server route and page sees for a logged-in Guild member. */
export interface AppSession {
  userId: string;
  authUserId: string;
  email: string;
  name: string;
  role: Role;
  memberId: string | null;
  /** The Admin level on top of officer. Only an officer can hold it. */
  siteAdmin: boolean;
  /** Officer title, e.g. "Vice President". Empty when not set. */
  title: string;
  /** On the board of directors. Independent of officer access. */
  director: boolean;
  /** Board title, e.g. "Chair". Empty when not set. */
  boardTitle?: string;
  /** An outside person or business providing services. */
  vendor?: boolean;
  /** What a vendor provides. Empty when not set. */
  vendorService?: string;
}

export interface AppUserRow {
  id: string;
  authUserId: string;
  email: string;
  name: string | null;
  role: Role;
  memberId: string | null;
  disabled: boolean;
  siteAdmin: boolean;
  title: string;
  director: boolean;
  boardTitle?: string;
  vendor?: boolean;
  vendorService?: string;
}

/** An app_users row as a session. A missing or disabled row gets no session. */
export function toAppSession(
  row: AppUserRow | null | undefined,
  user: { name?: string | null },
): AppSession | null {
  if (!row || row.disabled) return null;
  return {
    userId: row.id,
    authUserId: row.authUserId,
    email: row.email,
    name: row.name ?? user.name ?? row.email,
    role: row.role,
    memberId: row.memberId,
    siteAdmin: row.role === 'admin' && row.siteAdmin,
    title: row.role === 'admin' ? row.title : '',
    director: row.director,
    boardTitle: row.boardTitle ?? '',
    vendor: row.vendor ?? false,
    vendorService: row.vendorService ?? '',
  };
}

type HeaderFields = Pick<AppSession, 'role' | 'siteAdmin' | 'title'> &
  Partial<Pick<AppSession, 'director' | 'boardTitle' | 'vendor' | 'vendorService'>>;

/**
 * The line under the name in the portal header. The Admin runs the site and
 * is not presented as an officer, so their label is always "Admin". A
 * director or vendor who is not an officer sees their board title or service.
 */
export function roleLabelFor(s: HeaderFields, trade = ''): string {
  if (s.role !== 'admin') {
    if (s.director) return s.boardTitle || 'Director';
    if (s.vendor) return s.vendorService || 'Vendor';
    return trade || 'Guild member';
  }
  if (s.siteAdmin) return 'Admin';
  return s.title || 'Guild officer';
}

/** The word before "portal" in the header: Admin, Officer, Director, Vendor, or Tradesman. */
export function portalNameFor(
  s: Pick<AppSession, 'role' | 'siteAdmin'> & Partial<Pick<AppSession, 'director' | 'vendor'>>,
): string {
  if (s.siteAdmin) return 'Admin';
  if (s.role === 'admin') return 'Officer';
  if (s.director) return 'Director';
  if (s.vendor) return 'Vendor';
  return 'Tradesman';
}
