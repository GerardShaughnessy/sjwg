import { and, asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, documents, members } from '../schema';
import { HttpError } from '../../http';
import { isUniqueViolation } from '../../refs';
import { slugify } from '@/lib/trades';
import type { MemberUpdate } from '../../directory';

/** `availability` is no longer used; older callers may still pass it and it is ignored. */
type MemberInput = MemberUpdate & { availability?: string };

export function photoUrl(key: string | null) {
  return key ? `/api/files/members/${key.replace(/^members\//, '')}` : null;
}

export function memberView(m: typeof members.$inferSelect, accountEmail: string | null = null) {
  return {
    id: m.id,
    name: m.name,
    trade: m.trade,
    areas: m.areas,
    yearsInTrade: m.yearsInTrade,
    bio: m.bio,
    featured: m.featured,
    photo: photoUrl(m.photoKey),
    public: m.public,
    sortOrder: m.sortOrder,
    privatePhone: m.privatePhone ?? '',
    privateEmail: m.privateEmail ?? '',
    publicPhone: m.publicPhone,
    publicEmail: m.publicEmail,
    showContact: m.showContact,
    sample: Boolean(m.legacyId),
    accountEmail,
  };
}

/** Officers see everything, including private rows and the linked login. */
export async function listMembersAdmin() {
  const rows = await db()
    .select({ m: members, accountEmail: appUsers.email })
    .from(members)
    .leftJoin(appUsers, eq(appUsers.memberId, members.id))
    .orderBy(asc(members.trade), asc(members.name));
  return rows.map(({ m, accountEmail }) => memberView(m, accountEmail));
}

/** Members see a short roster for referrals. */
export async function listMembersBrief() {
  const rows = await db()
    .select({ id: members.id, name: members.name, trade: members.trade, public: members.public })
    .from(members)
    .orderBy(asc(members.name));
  return rows;
}

export async function getMember(id: string) {
  const [row] = await db().select().from(members).where(eq(members.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That member was not found.');
  return row;
}

function toRow(input: MemberInput) {
  return {
    name: input.name,
    trade: input.trade,
    areas: input.areas,
    yearsInTrade: input.yearsInTrade,
    bio: input.bio,
    public: input.public,
    featured: input.featured,
    sortOrder: input.sortOrder,
    privatePhone: input.privatePhone || null,
    privateEmail: input.privateEmail || null,
    ...(input.publicPhone === undefined ? {} : { publicPhone: input.publicPhone }),
    ...(input.publicEmail === undefined ? {} : { publicEmail: input.publicEmail }),
    ...(input.showContact === undefined ? {} : { showContact: input.showContact }),
  };
}

export async function createMember(input: MemberInput) {
  const root = slugify(input.name) || 'member';
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    try {
      const [row] = await db()
        .insert(members)
        .values({ ...toRow(input), slug })
        .returning();
      return row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(409, 'A member with that name already exists.');
}

export async function updateMember(id: string, input: MemberInput) {
  const [row] = await db()
    .update(members)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(members.id, id))
    .returning();
  if (!row) throw new HttpError(404, 'That member was not found.');
  return row;
}

/** Removes the entry and his private documents (certificates, license, insurance) with it. */
export async function deleteMember(id: string) {
  const [row] = await db().delete(members).where(eq(members.id, id)).returning();
  if (!row) throw new HttpError(404, 'That member was not found.');
  const docs = await db()
    .select()
    .from(documents)
    .where(and(eq(documents.ownerType, 'member'), eq(documents.ownerId, id)));
  const { deleteDocument } = await import('../../documents');
  for (const d of docs) await deleteDocument(d);
  return row;
}

/** Email for a member: his login first, then the private email on the entry. */
export async function memberContactEmail(memberId: string): Promise<string | null> {
  const [acct] = await db()
    .select({ email: appUsers.email })
    .from(appUsers)
    .where(eq(appUsers.memberId, memberId))
    .limit(1);
  if (acct) return acct.email;
  const m = await getMember(memberId);
  return m.privateEmail || null;
}
