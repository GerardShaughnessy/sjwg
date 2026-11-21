import type { APIRoute } from 'astro';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { aidApplications, documents } from '@/server/db/schema';
import { badRequest, json, requireRole, route } from '@/server/http';
import { AID_STATUSES } from '@/lib/aid';

export const prerender = false;

/** Officers only. Applications newest first, optionally one status. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const status = ctx.url.searchParams.get('status') ?? '';
  if (status && !(AID_STATUSES as readonly string[]).includes(status))
    throw badRequest('Unknown status.');
  const rows = await db()
    .select({
      id: aidApplications.id,
      ref: aidApplications.ref,
      applicantType: aidApplications.applicantType,
      status: aidApplications.status,
      contactName: aidApplications.contactName,
      orgName: aidApplications.orgName,
      urgency: aidApplications.urgency,
      awardCents: aidApplications.awardCents,
      createdAt: aidApplications.createdAt,
    })
    .from(aidApplications)
    .where(status ? eq(aidApplications.status, status) : undefined)
    .orderBy(desc(aidApplications.createdAt))
    .limit(500);
  const counts = rows.length
    ? await db()
        .select({ ownerId: documents.ownerId, n: sql<number>`count(*)::int` })
        .from(documents)
        .where(
          and(
            eq(documents.ownerType, 'aid'),
            inArray(
              documents.ownerId,
              rows.map((r) => r.id),
            ),
          ),
        )
        .groupBy(documents.ownerId)
    : [];
  const byId = new Map(counts.map((c) => [c.ownerId, c.n]));
  return json({
    applications: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      documentCount: byId.get(r.id) ?? 0,
    })),
  });
});
