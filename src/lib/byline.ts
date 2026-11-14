import { SITE_NAME } from '@/config/site';

/** A blog post is signed by its writer or by the Guild as a whole. */
export type Byline = 'author' | 'guild';
export const GUILD_BYLINE = SITE_NAME;
export const bylineOf = (authorName: string): Byline =>
  authorName === GUILD_BYLINE ? 'guild' : 'author';
