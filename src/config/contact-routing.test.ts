import { describe, expect, it } from 'vitest';
import { recipientsFor } from './contact-routing';

describe('recipientsFor', () => {
  it('sends events to Michael and hello@', () => {
    expect(recipientsFor('contact', 'Events or the Christmas party')).toEqual([
      'michael@sjwg.org',
      'hello@sjwg.org',
    ]);
  });
  it('sends giving to Michael, Greg, and the Secretary', () => {
    expect(recipientsFor('contact', 'Donations and giving')).toEqual([
      'michael@sjwg.org',
      'greg@sjwg.org',
      'secretary@sjwg.org',
      'hello@sjwg.org',
    ]);
  });
  it('falls back to hello@ for unknown topics and kinds', () => {
    expect(recipientsFor('contact', 'nope')).toEqual(['hello@sjwg.org']);
    expect(recipientsFor('mystery')).toEqual(['hello@sjwg.org']);
  });
  it('routes RSVPs to Michael and the pop-up to Greg', () => {
    expect(recipientsFor('rsvp')).toEqual(['michael@sjwg.org', 'hello@sjwg.org']);
    expect(recipientsFor('interest')).toEqual(['greg@sjwg.org', 'hello@sjwg.org']);
  });
});
