import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { donations } from '@/server/db/schema';
import { HttpError, json, readJson, requireRole, route } from '@/server/http';
import { donationView } from '@/server/db/queries/donations';
import { donationPatchSchema, parseOrThrow } from '@/server/schemas';

export const prerender = false;

export const PUT: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const patch = parseOrThrow(donationPatchSchema, await readJson(ctx));
  const set: Partial<typeof donations.$inferInsert> = {};
  if (patch.ackStatus) {
    set.ackStatus = patch.ackStatus;
    if (patch.ackStatus === 'sent' || patch.ackStatus === 'manual') set.ackSentAt = new Date();
  }
  if (patch.fmvCents !== undefined) set.fmvCents = patch.fmvCents;
  if (patch.note !== undefined) set.note = patch.note || null;
  const [row] = await db()
    .update(donations)
    .set(set)
    .where(eq(donations.id, ctx.params.id!))
    .returning();
  if (!row) throw new HttpError(404, 'That gift was not found.');
  return json({ donation: donationView(row) });
});

export const DELETE: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const [row] = await db()
    .select()
    .from(donations)
    .where(eq(donations.id, ctx.params.id!))
    .limit(1);
  if (!row) throw new HttpError(404, 'That gift was not found.');
  if (row.stripePaymentIntentId || row.stripeInvoiceId)
    throw new HttpError(
      409,
      'Card gifts come from Stripe and cannot be deleted here. Refund it in Stripe instead.',
    );
  await db().delete(donations).where(eq(donations.id, row.id));
  return json({ ok: true });
});
