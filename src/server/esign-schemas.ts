import { z } from 'astro/zod';
import { isEmail } from '@/lib/validate';
import { isSignDocKind } from '@/config/documents';
import { MEMBER_DOC_KINDS } from './documents';

/** Request bodies for documents and e-signature. Messages say what to fix. */
const sha = z.string().regex(/^[a-f0-9]{64}$/, 'Reload the page and try again.');
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-06-30.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'That date is not valid.');

/** POST /api/sign/[token] and /api/sign/request/[id] */
export const signSchema = z.object({
  consent: z.literal(true, { message: 'Agree to sign electronically first.' }),
  consentSha256: sha,
  signedName: z
    .string()
    .trim()
    .min(2, 'Type your full legal name.')
    .max(120, 'Keep your name under 120 characters.'),
  agree: z.literal(true, { message: 'Check the box to agree.' }),
  docSha256: sha,
});
export type SignInput = z.output<typeof signSchema>;

/** POST /api/sign/requests */
export const sendForSignatureSchema = z.object({
  docKind: z.string().refine(isSignDocKind, 'Pick a document.'),
  memberId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Who is signing?').max(120, 'Keep the name under 120 characters.'),
  email: z
    .string()
    .trim()
    .max(200)
    .refine(isEmail, 'Enter an email address like name@example.com.'),
});

/** PATCH /api/documents/[id] (officers) */
export const documentReviewSchema = z.object({
  status: z.enum(['pending', 'verified', 'rejected']).optional(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.').optional(),
  expiresOn: isoDate.nullable().optional(),
});

/** The text fields sent with a document upload. */
export const documentUploadSchema = z.object({
  kind: z.enum(Object.keys(MEMBER_DOC_KINDS) as [keyof typeof MEMBER_DOC_KINDS], {
    message: 'Pick what kind of document this is.',
  }),
  expiresOn: z.union([isoDate, z.literal('')]).optional(),
  memberId: z.string().uuid().optional(),
});
