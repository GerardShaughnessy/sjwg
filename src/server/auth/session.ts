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
  };
}

/** The line under the name in the portal header. */
export function roleLabelFor(
  s: Pick<AppSession, 'role' | 'siteAdmin' | 'title'>,
  trade = '',
): string {
  if (s.role !== 'admin') return trade || 'Guild member';
  return s.title || (s.siteAdmin ? 'Admin' : 'Guild officer');
}
