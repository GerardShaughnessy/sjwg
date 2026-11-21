import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { documents } from './db/schema';
import { readBlob, sniffImageType, uploadStore } from './uploads';

/**
 * Private documents: tradesmen's baptism and confirmation certificates,
 * licenses, insurance, and papers sent with an aid application. Stored in the
 * private blob store under docs/; only officers (and, for his own files, the
 * tradesman who uploaded them) can open them.
 */
/** Netlify functions accept about 6 MB per request after base64 encoding (about 4.4 MB of file), so one file stays under 4 MB. */
export const DOC_MAX_BYTES = 4 * 1024 * 1024;

export const DOC_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export const MEMBER_DOC_KINDS = {
  baptism: 'Baptism certificate',
  confirmation: 'Confirmation certificate',
  license: 'Trade license',
  insurance: 'Proof of insurance',
  w9: 'W-9',
  other: 'Other',
} as const;
export type MemberDocKind = keyof typeof MEMBER_DOC_KINDS;

export type OwnerType = 'member' | 'aid';
export type DocRow = typeof documents.$inferSelect;

/** Check the first bytes so a renamed file cannot pretend to be a PDF or photo. */
export function sniffDocType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-')
    return 'application/pdf';
  const img = sniffImageType(bytes);
  return img && img in DOC_TYPES ? img : null;
}

export type ValidDoc = { bytes: Uint8Array; contentType: string; ext: string };

export function validateDoc(bytes: Uint8Array): ValidDoc | { error: string } {
  if (bytes.byteLength === 0) return { error: 'That file is empty.' };
  if (bytes.byteLength > DOC_MAX_BYTES)
    return {
      error: 'That file is too big. Keep it under 4 MB. A phone photo or a scanned PDF usually is.',
    };
  const type = sniffDocType(bytes);
  if (!type) return { error: 'Use a PDF or a photo (JPEG, PNG, WebP, or HEIC).' };
  return { bytes, contentType: type, ext: DOC_TYPES[type] };
}

/** A safe display name: no path parts, no control characters, 120 characters at most. */
export function cleanFilename(name: string, ext: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    .replace(/[\u0000-\u001f\u007f"\\]/g, '')
    .trim()
    .slice(0, 120);
  return base || `document.${ext}`;
}

/** Store the bytes and record the row. Returns the new document row. */
export async function saveDocument(input: {
  ownerType: OwnerType;
  ownerId: string;
  kind: string;
  file: ValidDoc;
  filename: string;
  uploadedBy?: string | null;
  expiresOn?: string | null;
}): Promise<DocRow> {
  const key = `docs/${input.ownerType}/${input.ownerId}/${randomUUID()}.${input.file.ext}`;
  await uploadStore().set(key, new Blob([input.file.bytes as BlobPart]), {
    metadata: { contentType: input.file.contentType, size: input.file.bytes.byteLength },
  });
  const [row] = await db()
    .insert(documents)
    .values({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      kind: input.kind,
      filename: cleanFilename(input.filename, input.file.ext),
      blobKey: key,
      contentType: input.file.contentType,
      byteSize: input.file.bytes.byteLength,
      uploadedBy: input.uploadedBy ?? null,
      expiresOn: input.expiresOn ?? null,
    })
    .returning();
  return row;
}

export async function getDocument(id: string): Promise<DocRow | null> {
  const [row] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
  return row ?? null;
}

/** The file as a download. Never cached publicly; always served as an attachment. */
export async function documentResponse(doc: DocRow): Promise<Response | null> {
  const blob = await readBlob(doc.blobKey);
  if (!blob) return null;
  return new Response(blob.bytes, {
    headers: {
      'content-type': doc.contentType,
      'content-disposition': `inline; filename="${doc.filename.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'content-security-policy': 'sandbox',
    },
  });
}

export async function deleteDocument(doc: DocRow): Promise<void> {
  await db().delete(documents).where(eq(documents.id, doc.id));
  try {
    await uploadStore().delete(doc.blobKey);
  } catch (err) {
    console.warn('[documents] blob delete failed for', doc.blobKey, (err as Error).message);
  }
}
