import { z } from 'astro/zod';
import { isEmail } from '@/lib/validate';
import { AFFIRMATION_IDS } from '@/config/directory-terms';
import { memberAdminSchema, profileSchema } from './schemas';

/* Directory gate and contact opt-in. Kept out of schemas.ts on purpose. */

const trimmed = (max: number, msg?: string) =>
  z
    .string()
    .trim()
    .max(max, msg ?? `Keep this under ${max} characters.`);

const TIME_ZONE = 'America/Chicago';

/** Today on the Guild's clock, as YYYY-MM-DD. */
export function chicagoToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when `ymd` is a real date within two days of today (Chicago). */
export function isNearToday(ymd: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = Date.parse(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d) || new Date(d).toISOString().slice(0, 10) !== ymd) return false;
  const today = Date.parse(`${chicagoToday(now)}T00:00:00Z`);
  return Math.abs(d - today) <= 2 * DAY_MS;
}

export const affirmSchema = z
  .object({
    fullName: trimmed(120).min(1, 'Your full name.'),
    email: z
      .string()
      .trim()
      .max(200)
      .refine(isEmail, 'That email does not look right, like name@example.com.')
      .transform((v) => v.toLowerCase()),
    signedDate: z
      .string()
      .trim()
      .refine((v) => isNearToday(v), "Use today's date."),
    catholic: z.enum(['catholic', 'not-catholic'], {
      message: 'Choose the line that describes you.',
    }),
    alignmentNote: trimmed(2000, 'Keep this under 2000 characters.').default(''),
    affirm: z.record(z.string(), z.boolean()).default({}),
  })
  .superRefine((v, ctx) => {
    for (const id of AFFIRMATION_IDS) {
      if (v.affirm[id] !== true)
        ctx.addIssue({
          code: 'custom',
          path: ['affirm', id],
          message: 'Tick this box to continue.',
        });
    }
    if (v.catholic === 'not-catholic' && !v.alignmentNote)
      ctx.addIssue({
        code: 'custom',
        path: ['alignmentNote'],
        message: 'Tell us how your values align.',
      });
  });

export type AffirmInput = z.output<typeof affirmSchema>;

/** A tradesman saving his own entry. Availability is no longer edited. */
export const profileUpdateSchema = profileSchema.omit({ availability: true }).extend({
  showContact: z.boolean().optional(),
});

/** An officer saving any entry. */
export const memberUpdateSchema = memberAdminSchema.omit({ availability: true }).extend({
  showContact: z.boolean().optional(),
});
export type MemberUpdate = z.output<typeof memberUpdateSchema>;
