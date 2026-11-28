/**
 * The public URL for a sponsor logo. Blob keys are stored as
 * "sponsors/<id>/<hash>.png" and the file route adds the "sponsors/" prefix
 * itself, so it is stripped here.
 */
export function sponsorLogoUrl(logoKey: string | null | undefined): string | null {
  return logoKey ? `/api/files/sponsors/${logoKey.replace(/^sponsors\//, '')}` : null;
}
