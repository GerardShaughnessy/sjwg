import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { members } from '../schema';

export type DirectoryContact = { phone: string; email: string };

/**
 * Phone and email for public tradesmen who turned on "show my contact".
 * Read at request time for visitors with a valid directory cookie only.
 */
export async function listDirectoryContacts(): Promise<Record<string, DirectoryContact>> {
  const rows = await db()
    .select({ id: members.id, phone: members.privatePhone, email: members.privateEmail })
    .from(members)
    .where(and(eq(members.public, true), eq(members.showContact, true)));
  const out: Record<string, DirectoryContact> = {};
  for (const r of rows) {
    const phone = (r.phone ?? '').trim();
    const email = (r.email ?? '').trim();
    if (phone || email) out[r.id] = { phone, email };
  }
  return out;
}
