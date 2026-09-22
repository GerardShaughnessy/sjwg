import { Resend } from 'resend';
import { db } from '../db/client';
import { emailLog } from '../db/schema';
import { env } from '../env';
import type { Email } from './layout';

export interface SendOptions {
  to: string;
  email: Email;
  template: string;
  replyTo?: string;
  related?: { type: string; id: string };
}

export type SendResult =
  { status: 'sent'; id: string | null } | { status: 'failed' | 'skipped'; error: string };

/**
 * Sends through Resend and records the attempt in email_log. Never throws:
 * a request must still be saved when the mail provider is down. Callers that
 * need a retry check the `status`.
 */
export async function sendEmail(opts: SendOptions): Promise<SendResult> {
  const key = env('RESEND_API_KEY');
  const from = env('EMAIL_FROM') ?? 'St. Joseph the Worker Guild <onboarding@resend.dev>';
  let result: SendResult;
  if (!key) {
    result = { status: 'skipped', error: 'RESEND_API_KEY is not set' };
    console.warn(`[email] skipped ${opts.template} to ${opts.to}: no RESEND_API_KEY`);
  } else {
    try {
      const resend = new Resend(key);
      const { data, error } = await resend.emails.send({
        from,
        to: opts.to,
        replyTo: opts.replyTo,
        subject: opts.email.subject,
        text: opts.email.text,
        html: opts.email.html,
      });
      result = error
        ? { status: 'failed', error: error.message }
        : { status: 'sent', id: data?.id ?? null };
    } catch (err) {
      result = { status: 'failed', error: (err as Error).message };
    }
  }
  try {
    await db()
      .insert(emailLog)
      .values({
        toEmail: opts.to,
        template: opts.template,
        subject: opts.email.subject,
        providerId: result.status === 'sent' ? result.id : null,
        status: result.status,
        error: result.status === 'sent' ? null : result.error,
        relatedType: opts.related?.type,
        relatedId: opts.related?.id,
      });
  } catch (err) {
    console.error('[email] could not write email_log', err);
  }
  return result;
}
