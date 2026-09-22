import { describe, expect, it } from 'vitest';
import { sniffImageType, validateImage, PHOTO_MAX_BYTES } from './uploads';

const pad = (head: number[], len = 32) =>
  new Uint8Array([...head, ...new Array(len - head.length).fill(0)]);

describe('sniffImageType', () => {
  it('recognises jpeg, png, webp, heic, svg', () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageType(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(
      'image/webp',
    );
    expect(
      sniffImageType(pad([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])),
    ).toBe('image/heic');
    expect(
      sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    ).toBe('image/svg+xml');
  });
  it('rejects everything else', () => {
    expect(sniffImageType(new TextEncoder().encode('%PDF-1.4 some pdf content here'))).toBeNull();
    expect(sniffImageType(new Uint8Array(4))).toBeNull();
  });
});

describe('validateImage', () => {
  it('accepts a photo and reports type', () => {
    const v = validateImage(pad([0xff, 0xd8, 0xff, 0xe0]), 'photo');
    expect('ext' in v && v.ext).toBe('jpg');
  });
  it('refuses svg photos but allows svg logos', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect('error' in validateImage(svg, 'photo')).toBe(true);
    expect('ext' in validateImage(svg, 'logo')).toBe(true);
  });
  it('enforces size and emptiness', () => {
    expect(validateImage(new Uint8Array(0), 'photo')).toEqual({ error: 'That file is empty.' });
    const big = new Uint8Array(PHOTO_MAX_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect('error' in validateImage(big, 'photo')).toBe(true);
  });
});
