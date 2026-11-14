import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, posts } from '../schema';
import type { AppSession } from '../../auth/server';
import { HttpError } from '../../http';
import { isUniqueViolation } from '../../refs';
import { slugify } from '@/lib/trades';
import { GUILD_BYLINE, type Byline } from '@/lib/byline';

type PostInput = { title: string; description: string; bodyMd: string; byline?: Byline };

export function postView(p: typeof posts.$inferSelect) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    body: p.bodyMd,
    authorName: p.authorName,
    authorUserId: p.authorUserId,
    status: p.status,
    pubDate: p.pubDate?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Admins see every post; members see their own drafts plus everything published. */
export async function listPosts(session: AppSession) {
  const where =
    session.role === 'admin'
      ? undefined
      : or(eq(posts.authorUserId, session.userId), eq(posts.status, 'published'));
  const rows = await db()
    .select()
    .from(posts)
    .where(where)
    .orderBy(desc(posts.updatedAt))
    .limit(200);
  return rows.map(postView);
}

export async function getPost(id: string) {
  const [row] = await db().select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That post was not found.');
  return row;
}

export function canEdit(session: AppSession, p: typeof posts.$inferSelect) {
  return session.role === 'admin' || (p.authorUserId === session.userId && p.status === 'draft');
}

async function uniqueSlug(
  base: string,
  tryInsert: (slug: string) => Promise<typeof posts.$inferSelect>,
) {
  const root = slugify(base) || 'post';
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    try {
      return await tryInsert(slug);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(409, 'A post with that title already exists. Change the title a little.');
}

/** The writer's own name: the stored one, else their account name, else whoever is editing. */
async function writerName(p: typeof posts.$inferSelect, session: AppSession) {
  if (p.authorName && p.authorName !== GUILD_BYLINE) return p.authorName;
  if (p.authorUserId) {
    const [u] = await db()
      .select({ name: appUsers.name })
      .from(appUsers)
      .where(eq(appUsers.id, p.authorUserId))
      .limit(1);
    if (u?.name) return u.name;
  }
  return session.name;
}

export async function createPost({ byline, ...input }: PostInput, session: AppSession) {
  const d = db();
  const authorName = byline === 'guild' ? GUILD_BYLINE : session.name;
  return uniqueSlug(input.title, async (slug) => {
    const [row] = await d
      .insert(posts)
      .values({ ...input, slug, authorName, authorUserId: session.userId })
      .returning();
    return row;
  });
}

export async function updatePost(
  id: string,
  { byline, ...input }: PostInput,
  session: AppSession,
) {
  const p = await getPost(id);
  if (!canEdit(session, p))
    throw new HttpError(
      403,
      'Only the author can edit a draft, and only an officer can edit a published post.',
    );
  const [row] = await db()
    .update(posts)
    .set({
      ...input,
      authorName: byline === 'guild' ? GUILD_BYLINE : await writerName(p, session),
      updatedAt: new Date(),
      updatedDate: p.status === 'published' ? new Date() : null,
    })
    .where(eq(posts.id, id))
    .returning();
  return row;
}

export async function deletePost(id: string, session: AppSession) {
  const p = await getPost(id);
  if (!canEdit(session, p))
    throw new HttpError(
      403,
      'Only the author can delete a draft, and only an officer can delete a published post.',
    );
  await db().delete(posts).where(eq(posts.id, id));
  return p.status === 'published';
}

export async function setPublished(id: string, publish: boolean) {
  const p = await getPost(id);
  const [row] = await db()
    .update(posts)
    .set(
      publish
        ? { status: 'published', pubDate: p.pubDate ?? new Date(), updatedAt: new Date() }
        : { status: 'draft', updatedAt: new Date() },
    )
    .where(and(eq(posts.id, id)))
    .returning();
  return row;
}
