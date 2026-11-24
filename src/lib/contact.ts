/** The four contact fields on a directory entry. Nulls come from older rows. */
export type ContactFields = {
  publicEmail?: string | null;
  publicPhone?: string | null;
  privateEmail?: string | null;
  privatePhone?: string | null;
};

/**
 * What the directory shows for an entry whose tradesman turned on "show my contact":
 * the public email and phone when set, otherwise the private ones on file.
 */
export function directoryContact(c: ContactFields): { phone: string; email: string } {
  const pick = (pub?: string | null, priv?: string | null) =>
    (pub ?? '').trim() || (priv ?? '').trim();
  return {
    phone: pick(c.publicPhone, c.privatePhone),
    email: pick(c.publicEmail, c.privateEmail),
  };
}
