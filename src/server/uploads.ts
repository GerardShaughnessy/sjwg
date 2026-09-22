import { getStore, type Store } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { env } from './env';

/** Request photos and sponsor logos. Blobs are private; /api/files serves them. */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const LOGO_MAX_BYTES = 1 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};
const LOGO_TYPES: Record<string, string> = { ...IMAGE_TYPES, 'image/svg+xml': 'svg' };

let store: Store | null = null;
/**
 * One site-wide store per environment so previews and production never mix
 * and uploads survive redeploys. UPLOADS_STORE is "uploads" in the production
 * context and "uploads-dev" everywhere else (see .env.example).
 */
export function uploadStore(): Store {
  if (store) return store;
  const name = env('UPLOADS_STORE') ?? 'uploads-dev';
  store = getStore({ name, consistency: 'strong' });
  return store;
}

/** Check the first bytes so a renamed file cannot pretend to be an image. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/heic'; // ....ftyp
  const head = new TextDecoder().decode(b.slice(0, 256)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')))
    return 'image/svg+xml';
  return null;
}

export type Validated = { bytes: Uint8Array; contentType: string; ext: string };

export function validateImage(
  bytes: Uint8Array,
  kind: 'photo' | 'logo',
): Validated | { error: string } {
  const max = kind === 'photo' ? PHOTO_MAX_BYTES : LOGO_MAX_BYTES;
  if (bytes.byteLength === 0) return { error: 'That file is empty.' };
  if (bytes.byteLength > max)
    return { error: `That file is too big. Keep it under ${Math.round(max / 1024 / 1024)} MB.` };
  const type = sniffImageType(bytes);
  const allowed = kind === 'photo' ? IMAGE_TYPES : LOGO_TYPES;
  if (!type || !(type in allowed))
    return {
      error:
        kind === 'photo'
          ? 'Use a photo (JPEG, PNG, WebP, or HEIC).'
          : 'Use a PNG, JPEG, WebP, or SVG logo.',
    };
  return { bytes, contentType: type, ext: allowed[type] };
}

export async function putRequestPhoto(requestId: string, v: Validated, originalName?: string) {
  const key = `requests/${requestId}/${randomUUID()}.${v.ext}`;
  await uploadStore().set(key, new Blob([v.bytes as BlobPart]), {
    metadata: {
      contentType: v.contentType,
      originalName: originalName ?? '',
      size: v.bytes.byteLength,
    },
  });
  return key;
}

export async function putSponsorLogo(sponsorId: string, v: Validated) {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(v.bytes).digest('hex').slice(0, 8);
  const key = `sponsors/${sponsorId}/${hash}.${v.ext}`;
  await uploadStore().set(key, new Blob([v.bytes as BlobPart]), {
    metadata: { contentType: v.contentType, size: v.bytes.byteLength },
  });
  return key;
}

export async function readBlob(
  key: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await uploadStore().getWithMetadata(key, { type: 'arrayBuffer' });
    if (!res) return null;
    return {
      bytes: res.data,
      contentType: String(res.metadata.contentType ?? 'application/octet-stream'),
    };
  } catch (err) {
    // A blob written by another deploy context (or a missing store locally) reads as not found.
    console.warn('[uploads] read failed for', key, (err as Error).message);
    return null;
  }
}

export function fileResponse(
  blob: { bytes: ArrayBuffer; contentType: string },
  cache: 'immutable' | 'private',
) {
  const headers: Record<string, string> = {
    'content-type': blob.contentType,
    'x-content-type-options': 'nosniff',
    'cache-control':
      cache === 'immutable' ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
  };
  if (cache === 'immutable')
    headers['netlify-cdn-cache-control'] = 'public, max-age=31536000, immutable';
  if (blob.contentType === 'image/svg+xml') headers['content-security-policy'] = 'sandbox';
  return new Response(blob.bytes, { headers });
}
