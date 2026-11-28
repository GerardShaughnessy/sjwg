import { describe, expect, it } from 'vitest';
import { sponsorLogoUrl } from './sponsor-logo';

describe('sponsorLogoUrl', () => {
  it('does not repeat the sponsors/ prefix the file route adds', () => {
    expect(sponsorLogoUrl('sponsors/abc/1234.png')).toBe('/api/files/sponsors/abc/1234.png');
  });
  it('accepts a key without the prefix', () => {
    expect(sponsorLogoUrl('abc/1234.png')).toBe('/api/files/sponsors/abc/1234.png');
  });
  it('is null without a logo', () => {
    expect(sponsorLogoUrl(null)).toBeNull();
    expect(sponsorLogoUrl('')).toBeNull();
  });
});
