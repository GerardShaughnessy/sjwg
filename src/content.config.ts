import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import type { Loader } from 'astro/loaders';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Public pages are prerendered, so these loaders run at build time. They read
 * Neon when DATABASE_URL is set and fall back to the JSON and markdown seed in
 * src/data/seed when it is not (or the query fails), so a build never breaks
 * because the database was unreachable. The build log says which source won.
 */

const SEED_DIR = join(process.cwd(), 'src/data/seed');
/** astro build exposes .env through import.meta.env; Netlify and scripts use process.env. */
const DATABASE_URL: string | undefined =
  (import.meta.env as Record<string, string | undefined>).DATABASE_URL || process.env.DATABASE_URL;
const readSeed = <T>(file: string): T =>
  JSON.parse(readFileSync(join(SEED_DIR, file), 'utf8')) as T;

async function fromDbOrSeed<T>(
  name: string,
  query: () => Promise<T[]>,
  seed: () => T[],
): Promise<T[]> {
  if (DATABASE_URL) {
    try {
      const rows = await query();
      console.log(`[content] ${name}: ${rows.length} from database`);
      return rows;
    } catch (err) {
      console.warn(`[content] ${name}: database read failed, using seed.`, (err as Error).message);
    }
  } else {
    console.log(`[content] ${name}: DATABASE_URL not set, using seed`);
  }
  return seed();
}

async function dbModule() {
  const [{ db }, schema, { eq, asc, desc }] = await Promise.all([
    import('./server/db/client'),
    import('./server/db/schema'),
    import('drizzle-orm'),
  ]);
  return { db: db(), schema, eq, asc, desc };
}

/* ---------------------------------------------------------------- members */
const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  trade: z.string(),
  areas: z.array(z.string()).min(1),
  yearsInTrade: z.number().int().nonnegative(),
  bio: z.string(),
  availability: z.enum(['available', 'limited', 'unavailable']),
  featured: z.boolean().default(false),
  photo: z.string().nullable(),
  /** True for the fictional seed rows, so pages can label them. */
  sample: z.boolean().default(false),
});
type MemberRow = z.infer<typeof memberSchema>;

const members = defineCollection({
  loader: async () =>
    fromDbOrSeed<MemberRow>(
      'members',
      async () => {
        const { db, schema, eq, asc } = await dbModule();
        const rows = await db
          .select()
          .from(schema.members)
          .where(eq(schema.members.public, true))
          .orderBy(asc(schema.members.sortOrder), asc(schema.members.name));
        return rows.map((m) => ({
          id: m.id,
          name: m.name,
          trade: m.trade,
          areas: m.areas,
          yearsInTrade: m.yearsInTrade,
          bio: m.bio,
          availability: m.availability,
          featured: m.featured,
          photo: m.photoKey ? `/api/files/members/${m.photoKey.replace(/^members\//, '')}` : null,
          sample: Boolean(m.legacyId),
        }));
      },
      () =>
        readSeed<Omit<MemberRow, 'sample'>[]>('members.json').map((m) => ({ ...m, sample: true })),
    ),
  schema: memberSchema,
});

/* ----------------------------------------------------------------- events */
const eventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  kind: z.enum(['mass', 'meeting', 'retreat', 'procession', 'workday', 'party', 'other']),
  start: z.string(),
  end: z.string().optional(),
  location: z.string(),
  summary: z.string(),
  body: z.string(),
  membersOnly: z.boolean().default(false),
  tk: z.string().optional(),
});
type EventRow = z.infer<typeof eventSchema>;

const events = defineCollection({
  loader: async () =>
    fromDbOrSeed<EventRow>(
      'events',
      async () => {
        const { db, schema, eq, asc } = await dbModule();
        const rows = await db
          .select()
          .from(schema.events)
          .where(eq(schema.events.published, true))
          .orderBy(asc(schema.events.start));
        return rows.map((e) => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          kind: e.kind,
          start: e.start.toISOString(),
          end: e.end?.toISOString(),
          location: e.location,
          summary: e.summary,
          body: e.body,
          membersOnly: e.membersOnly,
          tk: e.tk ?? undefined,
        }));
      },
      () => readSeed<EventRow[]>('events.json'),
    ),
  schema: eventSchema,
});

/* ------------------------------------------------------------------- blog */
const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default(''),
  draft: z.boolean().default(false),
});

type SeedPost = { slug: string; data: z.input<typeof blogSchema>; body: string };

function seedPosts(): SeedPost[] {
  const dir = join(SEED_DIR, 'blog');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const fm: Record<string, string> = {};
      for (const line of (m?.[1] ?? '').split('\n')) {
        const i = line.indexOf(':');
        if (i > 0)
          fm[line.slice(0, i).trim()] = line
            .slice(i + 1)
            .trim()
            .replace(/^'(.*)'$/, '$1');
      }
      return {
        slug: f.replace(/\.md$/, ''),
        data: {
          title: fm.title,
          description: fm.description ?? '',
          pubDate: fm.pubDate,
          author: fm.author,
        },
        body: (m?.[2] ?? '').trim(),
      };
    });
}

const blogLoader: Loader = {
  name: 'sjwg-blog',
  load: async ({ store, renderMarkdown, parseData }) => {
    const posts = await fromDbOrSeed<SeedPost>(
      'blog',
      async () => {
        const { db, schema, eq, desc } = await dbModule();
        const rows = await db
          .select()
          .from(schema.posts)
          .where(eq(schema.posts.status, 'published'))
          .orderBy(desc(schema.posts.pubDate));
        return rows.map((p) => ({
          slug: p.slug,
          data: {
            title: p.title,
            description: p.description,
            pubDate: (p.pubDate ?? p.createdAt).toISOString(),
            updatedDate: p.updatedDate?.toISOString(),
            author: p.authorName,
          },
          body: p.bodyMd,
        }));
      },
      seedPosts,
    );
    store.clear();
    for (const p of posts) {
      const data = await parseData({ id: p.slug, data: p.data });
      store.set({ id: p.slug, data, body: p.body, rendered: await renderMarkdown(p.body) });
    }
  },
};

const blog = defineCollection({ loader: blogLoader, schema: blogSchema });

/* --------------------------------------------------------------- sponsors */
const sponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  tier: z.enum(['partner', 'sponsor', 'supporter', 'in-kind']),
  logo: z.string().nullable(),
  logoAlt: z.string(),
});
type SponsorRow = z.infer<typeof sponsorSchema>;

const sponsors = defineCollection({
  loader: async () =>
    fromDbOrSeed<SponsorRow>(
      'sponsors',
      async () => {
        const { db, schema, eq, asc } = await dbModule();
        const rows = await db
          .select()
          .from(schema.sponsors)
          .where(eq(schema.sponsors.active, true))
          .orderBy(asc(schema.sponsors.sortOrder), asc(schema.sponsors.name));
        return rows.map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          tier: s.tier,
          logo: s.logoKey ? `/api/files/sponsors/${s.logoKey}` : null,
          logoAlt: s.logoAlt || s.name,
        }));
      },
      () => [],
    ),
  schema: sponsorSchema,
});

export const collections = { blog, members, events, sponsors };
