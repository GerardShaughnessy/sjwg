import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { members } from '../schema';
import { directoryContact } from '@/lib/contact';

export type DirectoryContact = { phone: string; email: string };

/**
 * Phone and email for public tradesmen who turned on "show my contact":
 * the public ones when set, else the private ones on file.
 * Read at request time for visitors with a valid directory cookie only.
 */
export async function listDirectoryContacts(): Promise<Record<string, DirectoryContact>> {
  const rows = await db()
    .select({
      id: members.id,
      privatePhone: members.privatePhone,
      privateEmail: members.privateEmail,
      publicPhone: members.publicPhone,
      publicEmail: members.publicEmail,
    })
    .from(members)
    .where(and(eq(members.public, true), eq(members.showContact, true)));
  const out: Record<string, DirectoryContact> = {};
  for (const r of rows) {
    const { phone, email } = directoryContact(r);
    if (phone || email) out[r.id] = { phone, email };
  }
  return out;
}
