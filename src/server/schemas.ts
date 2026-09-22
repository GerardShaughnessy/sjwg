import { z } from 'astro/zod';
import { hasPhoneOrEmail, isEmail, isPhone, isZip } from '@/lib/validate';
import { HttpError } from './http';

/**
 * Request bodies, validated the same way the browser validates them so the two
 * never disagree. Messages say what to fix, in the wizard's voice.
 */
const trimmed = (max: number, msg?: string) =>
  z
    .string()
    .trim()
    .max(max, msg ?? `Keep this under ${max} characters.`);

export const URGENCIES = ['can-wait', 'getting-worse', 'no-heat-or-water'] as const;

export const requestAnswersSchema = z
  .object({
    trade: trimmed(80).min(1, 'Pick the kind of help you need. "Not sure" is fine.'),
    tradeSlug: trimmed(80).default(''),
    description: trimmed(4000, 'Keep the description under 4000 characters.').min(
      10,
      'Tell us a little more, even one more sentence helps.',
    ),
    urgency: z.enum(URGENCIES, { message: 'Pick how urgent it is.' }),
    zip: trimmed(10).default(''),
    neighborhood: trimmed(120).default(''),
    contact: z.object({
      name: trimmed(120).min(1, 'Tell us your name so we know who to ask for.'),
      phone: trimmed(40).default(''),
      email: trimmed(200).default(''),
      bestTime: trimmed(120).default(''),
    }),
  })
  .superRefine((v, ctx) => {
    if (!v.zip && !v.neighborhood)
      ctx.addIssue({
        code: 'custom',
        path: ['zip'],
        message: 'Give a zip code or a neighborhood so we know where you are.',
      });
    if (v.zip && !isZip(v.zip))
      ctx.addIssue({
        code: 'custom',
        path: ['zip'],
        message: 'That zip code does not look right. Five digits, like 63118.',
      });
    if (!hasPhoneOrEmail(v.contact.phone, v.contact.email)) {
      const path = v.contact.phone
        ? ['contact', 'phone']
        : v.contact.email
          ? ['contact', 'email']
          : ['contact', 'phone'];
      const message =
        !v.contact.phone && !v.contact.email
          ? 'Give a phone number or an email so someone can reach you.'
          : v.contact.phone && !isPhone(v.contact.phone)
            ? 'That phone number does not look right. Ten digits, like (314) 555-0147.'
            : 'That email does not look right, like name@example.com.';
      ctx.addIssue({ code: 'custom', path, message });
    }
  });
export type RequestAnswersInput = z.input<typeof requestAnswersSchema>;
export type RequestAnswers = z.output<typeof requestAnswersSchema>;

export const noteSchema = z.object({
  body: trimmed(2000, 'Keep the note under 2000 characters.').min(1, 'Write something first.'),
  visibleToRequester: z.boolean().default(true),
});

export const referSchema = z.object({
  note: trimmed(500).min(1, 'Say who you referred this to.'),
});

const emailField = z
  .string()
  .trim()
  .refine((v) => isEmail(v), 'That email does not look right, like name@example.com.');

const optionalText = trimmed(4000).default('');
const phoneField = trimmed(40)
  .default('')
  .refine((v) => !v || isPhone(v), 'Ten digits with area code.');
const honeypot = z.string().max(0, 'Leave that field empty.').optional();

/** Field ids match the FieldSpec lists on the contact and get-involved pages. */
export const formSchemas = {
  contact: z.object({
    name: trimmed(120).min(1, 'Tell us your name.'),
    email: emailField,
    phone: phoneField,
    message: trimmed(4000).min(1, 'A sentence or two is enough.'),
    website: honeypot,
  }),
  partner: z.object({
    organization: trimmed(200).min(1, 'Which organization are you with?'),
    name: trimmed(120).min(1, 'Tell us your name.'),
    role: optionalText,
    email: emailField,
    phone: phoneField,
    type: optionalText,
    message: trimmed(4000).min(1, 'A sentence or two is enough.'),
    website: honeypot,
  }),
  membership: z
    .object({
      name: trimmed(120).min(1, 'Tell us your name.'),
      trade: trimmed(120).min(1, 'What trade are you in?'),
      business: optionalText,
      phone: phoneField,
      email: trimmed(200)
        .default('')
        .refine((v) => !v || isEmail(v), 'That email is missing something, like the part after @.'),
      parish: optionalText,
      note: optionalText,
      website: honeypot,
    })
    .superRefine((v, ctx) => {
      if (!v.phone && !v.email)
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'A phone number or an email, whichever you check.',
        });
    }),
} as const;
export type FormKind = keyof typeof formSchemas;

export const invitationSchema = z.object({
  email: emailField,
  name: trimmed(120).default(''),
  role: z.enum(['admin', 'member']).default('member'),
  memberId: z.string().uuid().nullable().optional(),
});

export const acceptInviteSchema = z.object({ token: z.string().min(20) });

/** Flatten zod issues into `{ fields, message }` for HttpError. */
export function issuesToFields(issues: z.ZodIssue[]): {
  message: string;
  fields: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join('.') || 'form';
    if (!fields[key]) fields[key] = i.message;
  }
  const first = Object.values(fields)[0] ?? 'Check the form and try again.';
  return { message: first, fields };
}

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const { message, fields } = issuesToFields(r.error.issues);
  throw new HttpError(400, message, fields);
}
