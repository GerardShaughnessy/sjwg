import type { APIRoute } from 'astro';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { aidApplications, appUsers, documents } from '@/server/db/schema';
import { json, notFound, readJson, requireRole, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { aidDecisionSchema } from '@/server/aid';

export const prerender = false;

async function load(id: string) {
  const [row] = await db()
    .select({ app: aidApplications, decidedByName: appUsers.name, decidedByEmail: appUsers.email })
    .from(aidApplications)
    .leftJoin(appUsers, eq(appUsers.id, aidApplications.decidedBy))
    .where(eq(aidApplications.id, id))
    .limit(1);
  if (!row) throw notFound('That application was not found.');
  return row;
}

async function view(id: string) {
  const { app, decidedByName, decidedByEmail } = await load(id);
  const docs = await db()
    .select({
      id: documents.id,
      filename: documents.filename,
      contentType: documents.contentType,
      byteSize: documents.byteSize,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(eq(documents.ownerType, 'aid'), eq(documents.ownerId, app.id)))
    .orderBy(asc(documents.createdAt));
  return {
    id: app.id,
    ref: app.ref,
    applicantType: app.applicantType,
    status: app.status,
    contactName: app.contactName,
    email: app.email,
    phone: app.phone,
    orgName: app.orgName,
    urgency: app.urgency,
    answers: app.answers as Record<string, unknown>,
    awardCents: app.awardCents,
    decisionNote: app.decisionNote,
    decidedBy: app.decidedBy ? (decidedByName ?? decidedByEmail ?? 'An officer') : null,
    decidedAt: app.decidedAt?.toISOString() ?? null,
    notifiedAt: app.notifiedAt?.toISOString() ?? null,
    createdAt: app.createdAt.toISOString(),
    documents: docs.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      url: `/api/aid/${app.id}/documents/${d.id}`,
    })),
  };
}

/** Officers only. Every answer plus document metadata. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json({ application: await view(ctx.params.id!) });
});

/** Officers only. Status, award, and note. Approving or declining records who and when. */
export const PATCH: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const { app } = await load(ctx.params.id!);
  const input = parseOrThrow(aidDecisionSchema, await readJson(ctx));
  // Whoever sets or changes a decision (status, award, or note on an approved or
  // declined case) is recorded; moving back to an open status clears it.
  const decided = input.status === 'approved' || input.status === 'declined';
  const changed =
    input.status !== app.status ||
    input.awardCents !== app.awardCents ||
    input.decisionNote !== app.decisionNote;
  await db()
    .update(aidApplications)
    .set({
      status: input.status,
      awardCents: input.awardCents,
      decisionNote: input.decisionNote,
      updatedAt: new Date(),
      ...(decided
        ? changed
          ? { decidedBy: session.userId, decidedAt: new Date() }
          : {}
        : { decidedBy: null, decidedAt: null }),
    })
    .where(eq(aidApplications.id, app.id));
  return json({ application: await view(app.id) });
});
