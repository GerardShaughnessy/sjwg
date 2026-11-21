import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './db/client';
import { appUsers, documents, members } from './db/schema';
import { MEMBER_DOC_KINDS, type DocRow } from './documents';

/** Tradesmen's private documents (ownerType 'member'), shaped for the portal. */
export interface MemberDocView {
  id: string;
  memberId: string;
  kind: string;
  kindLabel: string;
  filename: string;
  contentType: string;
  byteSize: number;
  status: 'pending' | 'verified' | 'rejected';
  note: string;
  expiresOn: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  fileUrl: string;
}

export function toDocView(d: DocRow, reviewedByName: string | null = null): MemberDocView {
  return {
    id: d.id,
    memberId: d.ownerId,
    kind: d.kind,
    kindLabel: MEMBER_DOC_KINDS[d.kind as keyof typeof MEMBER_DOC_KINDS] ?? d.kind,
    filename: d.filename,
    contentType: d.contentType,
    byteSize: d.byteSize,
    status: (['pending', 'verified', 'rejected'].includes(d.status)
      ? d.status
      : 'pending') as MemberDocView['status'],
    note: d.note,
    expiresOn: d.expiresOn ?? null,
    createdAt: d.createdAt.toISOString(),
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    reviewedByName,
    fileUrl: `/api/documents/${d.id}/file`,
  };
}

export async function listMemberDocs(memberId?: string): Promise<MemberDocView[]> {
  const where = memberId
    ? and(eq(documents.ownerType, 'member'), eq(documents.ownerId, memberId))
    : eq(documents.ownerType, 'member');
  const rows = await db()
    .select({ d: documents, reviewer: appUsers.name })
    .from(documents)
    .leftJoin(appUsers, eq(documents.reviewedBy, appUsers.id))
    .where(where)
    .orderBy(desc(documents.createdAt))
    .limit(1000);
  return rows.map((r) => toDocView(r.d, r.reviewer));
}

export async function memberBriefs() {
  return db()
    .select({
      id: members.id,
      name: members.name,
      trade: members.trade,
      privateEmail: members.privateEmail,
    })
    .from(members)
    .orderBy(asc(members.name));
}

export async function memberExists(id: string): Promise<boolean> {
  const [m] = await db()
    .select({ id: members.id })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  return Boolean(m);
}
