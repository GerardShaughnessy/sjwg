import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { donations, donors } from '../schema';
import { toCsv } from '@/lib/csv';

export function donationView(d: typeof donations.$inferSelect) {
  return {
    id: d.id,
    date: d.receivedAt,
    donorName: d.donorName,
    donorEmail: d.donorEmail ?? '',
    amount: d.amountCents / 100,
    amountCents: d.amountCents,
    method: d.method,
    fund: d.fund,
    tier: d.tier ?? '',
    recurring: d.recurring,
    ackStatus: d.ackStatus,
    note: d.note ?? '',
    stripe: Boolean(d.stripePaymentIntentId || d.stripeInvoiceId),
  };
}
export type DonationView = ReturnType<typeof donationView>;

export async function listDonations(limit = 1000) {
  const rows = await db()
    .select()
    .from(donations)
    .orderBy(desc(donations.receivedAt), desc(donations.createdAt))
    .limit(limit);
  return rows.map(donationView);
}

export function donationsCsv(list: DonationView[]) {
  return toCsv(
    list.map((d) => ({
      date: d.date,
      donor: d.donorName,
      email: d.donorEmail,
      amount: d.amount,
      method: d.method,
      fund: d.fund,
      tier: d.tier,
      recurring: d.recurring ? 'yes' : 'no',
      acknowledgment: d.ackStatus,
      note: d.note,
    })),
  );
}

/** Find or create the donor row by email (preferred) or exact name. */
export async function upsertDonor(input: {
  name: string;
  email?: string | null;
  stripeCustomerId?: string | null;
}) {
  const d = db();
  const email = input.email?.trim().toLowerCase() || null;
  if (input.stripeCustomerId) {
    const [byStripe] = await d
      .select()
      .from(donors)
      .where(eq(donors.stripeCustomerId, input.stripeCustomerId))
      .limit(1);
    if (byStripe) return byStripe;
  }
  if (email) {
    const [byEmail] = await d
      .select()
      .from(donors)
      .where(sql`lower(${donors.email}) = ${email}`)
      .limit(1);
    if (byEmail) {
      if (input.stripeCustomerId && !byEmail.stripeCustomerId)
        await d
          .update(donors)
          .set({ stripeCustomerId: input.stripeCustomerId })
          .where(eq(donors.id, byEmail.id));
      return byEmail;
    }
  }
  const [row] = await d
    .insert(donors)
    .values({ name: input.name, email, stripeCustomerId: input.stripeCustomerId ?? null })
    .returning();
  return row;
}
