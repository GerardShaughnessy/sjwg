import { desc, isNull, sql } from 'drizzle-orm';
import { db } from '../client';
import { subscribers } from '../schema';
import { toCsv } from '@/lib/csv';

export type SubscriberRow = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  createdAt: string;
};

/**
 * Adds an email to the list, or re-subscribes one that left. Signing up twice
 * is not an error: the first source is kept and a missing name is filled in.
 */
export async function addSubscriber(input: {
  email: string;
  name?: string;
  source: string;
  ipHash: string | null;
}): Promise<void> {
  await db()
    .insert(subscribers)
    .values({
      email: input.email,
      name: input.name || null,
      source: input.source,
      ipHash: input.ipHash,
    })
    .onConflictDoUpdate({
      target: subscribers.email,
      set: {
        unsubscribedAt: null,
        name: sql`coalesce(${subscribers.name}, excluded.name)`,
        updatedAt: new Date(),
      },
    });
}

export async function listSubscribers(): Promise<SubscriberRow[]> {
  const rows = await db()
    .select()
    .from(subscribers)
    .where(isNull(subscribers.unsubscribedAt))
    .orderBy(desc(subscribers.createdAt));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function subscribersCsv(rows: SubscriberRow[]): string {
  return toCsv(
    rows.map((r) => ({
      email: r.email,
      name: r.name ?? '',
      signed_up_from: r.source,
      signed_up: r.createdAt.slice(0, 10),
    })),
  );
}
