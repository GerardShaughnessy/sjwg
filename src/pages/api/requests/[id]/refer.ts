import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { requests } from '@/server/db/schema';
import { json, readJson, requireSession, route } from '@/server/http';
import { getMember, memberContactEmail } from '@/server/db/queries/members';
import { transition } from '@/server/db/queries/requests';
import { parseOrThrow, referSchema } from '@/server/schemas';
import { sendEmail } from '@/server/email/send';
import { referralNotice } from '@/server/email/templates/request';

export const prerender = false;

/** Refer to a named member (he gets an email) or leave a free-text note about who has it. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const { memberId, note } = parseOrThrow(referSchema, await readJson(ctx));
  const member = memberId ? await getMember(memberId) : null;
  const text = member ? `Referred to ${member.name}${note ? `: ${note}` : ''}` : note;
  const updated = await transition(ctx.params.id!, 'refer', session, text);
  let emailed = false;
  if (member) {
    await db().update(requests).set({ referredTo: member.id }).where(eq(requests.id, updated.id));
    const to = await memberContactEmail(member.id);
    if (to) {
      const res = await sendEmail({
        to,
        email: referralNotice({
          memberName: member.name,
          referredBy: session.name,
          note,
          request: updated,
        }),
        template: 'referral',
        related: { type: 'request', id: updated.id },
      });
      emailed = res.status === 'sent';
    }
  }
  return json({
    id: updated.id,
    status: updated.status,
    notes: updated.referralNote,
    emailed,
    hasEmail: member ? Boolean(await memberContactEmail(member.id)) : null,
  });
});
