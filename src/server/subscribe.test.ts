import { describe, expect, it } from 'vitest';
import { subscribeSchema } from './schemas';

describe('subscribeSchema', () => {
  it('lowercases and trims the email, and defaults the name', () => {
    const v = subscribeSchema.parse({ email: '  Joe.Smith@Example.COM ', source: 'popup' });
    expect(v).toEqual({ email: 'joe.smith@example.com', name: '', source: 'popup' });
  });
  it('falls back to "site" for an unknown source', () => {
    expect(subscribeSchema.parse({ email: 'a@b.co', source: 'evil' }).source).toBe('site');
  });
  it('rejects a bad email', () => {
    expect(subscribeSchema.safeParse({ email: 'not-an-email', source: 'footer' }).success).toBe(
      false,
    );
  });
});
