import { describe, expect, it } from 'vitest';
import { directoryContact } from './contact';

describe('directoryContact', () => {
  it('prefers the public email and phone', () => {
    expect(
      directoryContact({
        publicEmail: 'shop@example.com',
        publicPhone: '(314) 555-0100',
        privateEmail: 'me@example.com',
        privatePhone: '(314) 555-0199',
      }),
    ).toEqual({ email: 'shop@example.com', phone: '(314) 555-0100' });
  });

  it('falls back to the private ones when public is blank', () => {
    expect(
      directoryContact({
        publicEmail: '  ',
        publicPhone: '',
        privateEmail: 'me@example.com',
        privatePhone: '(314) 555-0199',
      }),
    ).toEqual({ email: 'me@example.com', phone: '(314) 555-0199' });
  });

  it('falls back per field', () => {
    expect(
      directoryContact({
        publicEmail: 'shop@example.com',
        privateEmail: 'me@example.com',
        privatePhone: '(314) 555-0199',
      }),
    ).toEqual({ email: 'shop@example.com', phone: '(314) 555-0199' });
    expect(
      directoryContact({ publicPhone: '314-555-0100', privateEmail: 'me@example.com' }),
    ).toEqual({ email: 'me@example.com', phone: '314-555-0100' });
  });

  it('handles nulls and trims', () => {
    expect(
      directoryContact({
        publicEmail: null,
        publicPhone: null,
        privateEmail: ' me@example.com ',
        privatePhone: null,
      }),
    ).toEqual({ email: 'me@example.com', phone: '' });
    expect(directoryContact({})).toEqual({ email: '', phone: '' });
  });
});
