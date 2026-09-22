import type { APIRoute } from 'astro';
import { db } from '@/server/db/client';
import { donations } from '@/server/db/schema';
import { json, readJson, requireRole, route } from '@/server/http';
import { donationView, listDonations, upsertDonor } from '@/server/db/queries/donations';
import { manualDonationSchema, parseOrThrow } from '@/server/schemas';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json({ donations: await listDonations() });
});

/** Manual entry for checks, cash, and bank transfers handed over in person. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const input = parseOrThrow(manualDonationSchema, await readJson(ctx));
  const donor = await upsertDonor({ name: input.donorName, email: input.donorEmail });
  const [row] = await db()
    .insert(donations)
    .values({
      donorId: donor.id,
      donorName: input.donorName,
      donorEmail: input.donorEmail || null,
      amountCents: input.amountCents,
      method: input.method,
      fund: input.fund || 'general',
      tier: input.tier || null,
      recurring: input.recurring,
      interval: input.recurring ? 'month' : null,
      receivedAt: input.receivedAt,
      ackStatus: 'manual',
      enteredBy: session.userId,
      note: input.note || null,
    })
    .returning();
  return json({ donation: donationView(row) }, 201);
});
