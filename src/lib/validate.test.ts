import { describe, it, expect } from 'vitest';
import { isEmail, isPhone, isZip, hasPhoneOrEmail, required } from './validate';

describe('validate', () => {
  it('checks email loosely', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('nope')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
  it('accepts US phone formats with 10 or 11 digits', () => {
    expect(isPhone('(314) 555-0101')).toBe(true);
    expect(isPhone('314.555.0101')).toBe(true);
    expect(isPhone('1 314 555 0101')).toBe(true);
    expect(isPhone('555-0101')).toBe(false);
  });
  it('accepts 5 digit or ZIP+4', () => {
    expect(isZip('63118')).toBe(true);
    expect(isZip('63118-1234')).toBe(true);
    expect(isZip('6311')).toBe(false);
  });
  it('requires at least one of phone or email, not both', () => {
    expect(hasPhoneOrEmail('', 'a@b.co')).toBe(true);
    expect(hasPhoneOrEmail('3145550101', '')).toBe(true);
    expect(hasPhoneOrEmail('', '')).toBe(false);
    expect(hasPhoneOrEmail('12', 'bad')).toBe(false);
  });
  it('required trims whitespace', () => {
    expect(required('  ')).toBe(false);
    expect(required(' x ')).toBe(true);
  });
});
