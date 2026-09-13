/** No 0/O or 1/I so a reference can be read over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function makeRef(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `SJWG-${s}`;
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomInt(1e9).toString(36)}`;
}
