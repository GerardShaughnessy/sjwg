import { describe, expect, it } from 'vitest';
import { GUILD_BYLINE, bylineOf } from './byline';
import { postSchema } from '@/server/schemas';

describe('blog byline', () => {
  it('reads a post signed as the Guild', () => {
    expect(GUILD_BYLINE).toBe('St. Joseph the Worker Guild');
    expect(bylineOf(GUILD_BYLINE)).toBe('guild');
    expect(bylineOf('Greg Miller')).toBe('author');
  });
  it('defaults to the writer and rejects unknown choices', () => {
    expect(postSchema.parse({ title: 'Hi' }).byline).toBe('author');
    expect(postSchema.parse({ title: 'Hi', byline: 'guild' }).byline).toBe('guild');
    expect(postSchema.safeParse({ title: 'Hi', byline: 'pope' }).success).toBe(false);
  });
});
