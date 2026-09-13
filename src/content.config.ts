import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/**
 * Blog posts are markdown files in src/content/blog.
 * // BACKEND: a git-based CMS (Decap) would write into this same folder; the
 * portal's post editor saves drafts to localStorage as a stand-in for that.
 */
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('[[TK: author]]'),
    draft: z.boolean().default(false),
  }),
});

/** Single source for the directory, the home strip, and the request flow's trade list. */
const members = defineCollection({
  loader: file('./src/data/members.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    trade: z.string(),
    areas: z.array(z.string()).min(1),
    yearsInTrade: z.number().int().nonnegative(),
    bio: z.string(),
    availability: z.enum(['available', 'limited', 'unavailable']),
    featured: z.boolean().default(false),
    photo: z.string().nullable(),
  }),
});

const events = defineCollection({
  loader: file('./src/data/events.json'),
  schema: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    kind: z.enum(['mass', 'meeting', 'retreat', 'procession', 'workday', 'party', 'other']),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }).optional(),
    location: z.string(),
    summary: z.string(),
    body: z.string(),
    membersOnly: z.boolean().default(false),
    tk: z.string().optional(),
  }),
});

export const collections = { blog, members, events };
