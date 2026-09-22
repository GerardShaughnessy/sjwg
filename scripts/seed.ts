/**
 * Seed a Neon branch with the sample content the mockup shipped with.
 * Idempotent: rows are matched by natural keys (legacy ids, slugs, refs).
 *
 *   npm run db:seed                    seed content only
 *   npm run db:seed -- --with-test-users   also create guildmember@test.com + an admin (dev branch only)
 *   npm run db:seed -- --admin you@example.com   print an invitation link for the first admin
 *
 * Reads DATABASE_URL and NEON_AUTH_BASE_URL from .env (or the environment).
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/server/db/client';
import * as t from '../src/server/db/schema';
import { GIVING_LEVELS } from '../src/config/site';
import { makeToken, sha256 } from '../src/server/refs';
import { slugify } from '../src/lib/trades';

const ROOT = join(import.meta.dirname, '..');
const SEED = join(ROOT, 'src/data/seed');
const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const readJson = <T>(f: string) => JSON.parse(readFileSync(join(SEED, f), 'utf8')) as T;

async function main() {
  const d = db();
  const url = process.env.DATABASE_URL ?? '';
  console.log(`Seeding ${url.replace(/\/\/.*@/, '//***@')}`);

  /* members */
  type SeedMember = {
    id: string;
    name: string;
    trade: string;
    areas: string[];
    yearsInTrade: number;
    bio: string;
    availability: 'available' | 'limited' | 'unavailable';
    featured: boolean;
    photo: string | null;
  };
  const memberIds = new Map<string, string>();
  for (const [i, m] of readJson<SeedMember[]>('members.json').entries()) {
    const [row] = await d
      .insert(t.members)
      .values({
        legacyId: m.id,
        slug: slugify(m.name),
        name: m.name,
        trade: m.trade,
        areas: m.areas,
        yearsInTrade: m.yearsInTrade,
        bio: m.bio,
        availability: m.availability,
        featured: m.featured,
        public: true, // fictional seed rows; real members flip this after consent
        sortOrder: i,
      })
      .onConflictDoUpdate({
        target: t.members.legacyId,
        set: {
          name: m.name,
          trade: m.trade,
          areas: m.areas,
          bio: m.bio,
          availability: m.availability,
          featured: m.featured,
          sortOrder: i,
          updatedAt: new Date(),
        },
      })
      .returning({ id: t.members.id });
    memberIds.set(m.id, row.id);
  }
  console.log(`members: ${memberIds.size}`);

  /* events */
  type SeedEvent = {
    id: string;
    slug: string;
    title: string;
    kind: 'mass' | 'meeting' | 'retreat' | 'procession' | 'workday' | 'party' | 'other';
    start: string;
    end?: string;
    location: string;
    summary: string;
    body: string;
    membersOnly: boolean;
    tk?: string;
  };
  const evs = readJson<SeedEvent[]>('events.json');
  for (const e of evs) {
    await d
      .insert(t.events)
      .values({
        slug: e.slug,
        title: e.title,
        kind: e.kind,
        start: new Date(e.start),
        end: e.end ? new Date(e.end) : null,
        location: e.location,
        summary: e.summary,
        body: e.body,
        membersOnly: e.membersOnly,
        published: true,
        tk: e.tk ?? null,
      })
      .onConflictDoUpdate({
        target: t.events.slug,
        set: {
          title: e.title,
          kind: e.kind,
          start: new Date(e.start),
          end: e.end ? new Date(e.end) : null,
          location: e.location,
          summary: e.summary,
          body: e.body,
          membersOnly: e.membersOnly,
          tk: e.tk ?? null,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`events: ${evs.length}`);

  /* posts from markdown */
  const blogDir = join(SEED, 'blog');
  let postCount = 0;
  for (const f of readdirSync(blogDir).filter((n) => n.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) continue;
    const fm: Record<string, string> = {};
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0)
        fm[line.slice(0, i).trim()] = line
          .slice(i + 1)
          .trim()
          .replace(/^'(.*)'$/, '$1');
    }
    const slug = f.replace(/\.md$/, '');
    const values = {
      slug,
      title: fm.title,
      description: fm.description ?? '',
      bodyMd: m[2].trim(),
      authorName: fm.author ?? '',
      status: 'published' as const,
      pubDate: new Date(fm.pubDate),
    };
    await d
      .insert(t.posts)
      .values(values)
      .onConflictDoUpdate({ target: t.posts.slug, set: { ...values, updatedAt: new Date() } });
    postCount++;
  }
  console.log(`posts: ${postCount}`);

  /* giving tiers */
  for (const [i, g] of GIVING_LEVELS.entries()) {
    await d
      .insert(t.givingTiers)
      .values({
        key: g.key,
        name: g.name,
        minCents: g.minCents,
        benefits: [...g.benefits],
        sort: i,
        fmvNote:
          'TODO accountant: price the benefits before formal receipts go out for this level.',
      })
      .onConflictDoUpdate({
        target: t.givingTiers.key,
        set: { name: g.name, minCents: g.minCents, benefits: [...g.benefits], sort: i },
      });
  }
  console.log(`giving tiers: ${GIVING_LEVELS.length}`);

  /* donations (fictional, portal demo) */
  type SeedDonation = {
    id: string;
    date: string;
    donorName: string;
    amount: number;
    method: 'check' | 'card' | 'cash' | 'other';
    fund: string;
    tier: string;
    recurring: boolean;
  };
  const dons = readJson<SeedDonation[]>('donations.json');
  const existing = await d
    .select({ n: sql<number>`count(*)` })
    .from(t.donations)
    .where(sql`${t.donations.note} = 'seed: fictional'`);
  if (Number(existing[0].n) === 0) {
    for (const s of dons) {
      const [donor] = await d
        .insert(t.donors)
        .values({ name: s.donorName, email: `${slugify(s.donorName)}@example.com` })
        .onConflictDoNothing()
        .returning({ id: t.donors.id });
      const donorId =
        donor?.id ??
        (
          await d.select({ id: t.donors.id }).from(t.donors).where(eq(t.donors.name, s.donorName))
        )[0]?.id;
      await d.insert(t.donations).values({
        donorId,
        donorName: s.donorName,
        amountCents: Math.round(s.amount * 100),
        method: s.method,
        fund: s.fund,
        tier: s.tier.toLowerCase(),
        recurring: s.recurring,
        interval: s.recurring ? 'month' : null,
        receivedAt: s.date,
        ackStatus: 'not_required',
        note: 'seed: fictional',
      });
    }
    console.log(`donations: ${dons.length}`);
  } else {
    console.log('donations: already seeded');
  }

  /* sample requests */
  type SeedRequest = {
    id: string;
    ref: string;
    createdAt: string;
    status: 'open' | 'claimed' | 'referred' | 'closed';
    claimedBy?: string;
    notes?: string;
    trade: string;
    tradeSlug: string;
    description: string;
    urgency: 'can-wait' | 'getting-worse' | 'no-heat-or-water';
    zip: string;
    neighborhood: string;
    contact: { name: string; phone: string; email: string; bestTime: string };
  };
  const reqs = readJson<SeedRequest[]>('sample-requests.json');
  for (const r of reqs) {
    const token = makeToken();
    const [row] = await d
      .insert(t.requests)
      .values({
        ref: r.ref,
        status: r.status,
        trade: r.trade,
        tradeSlug: r.tradeSlug,
        description: r.description,
        urgency: r.urgency,
        zip: r.zip,
        neighborhood: r.neighborhood,
        contactName: r.contact.name,
        contactPhone: r.contact.phone,
        contactEmail: r.contact.email,
        bestTime: r.contact.bestTime,
        trackingTokenHash: sha256(token),
        claimedBy: r.claimedBy ? (memberIds.get(r.claimedBy) ?? null) : null,
        claimedAt: r.claimedBy ? new Date(r.createdAt) : null,
        referralNote: r.notes ?? null,
        source: 'seed',
        createdAt: new Date(r.createdAt),
      })
      .onConflictDoNothing({ target: t.requests.ref })
      .returning({ id: t.requests.id });
    if (row) {
      await d
        .insert(t.requestEvents)
        .values({
          requestId: row.id,
          actorKind: 'system',
          action: 'created',
          toStatus: 'open',
          detail: { seed: true },
          createdAt: new Date(r.createdAt),
        });
      console.log(`request ${r.ref}: tracking link /request/track/${token}`);
    }
  }

  /* settings */
  await d.insert(t.settings).values({ key: 'rebuild_pending', value: false }).onConflictDoNothing();

  /* test users (dev only) */
  if (flag('--with-test-users')) {
    const base = process.env.NEON_AUTH_BASE_URL;
    if (!base) throw new Error('NEON_AUTH_BASE_URL is required for --with-test-users');
    const password = process.env.SEED_TEST_PASSWORD ?? 'guild2026-dev';
    const users = [
      {
        email: 'guildmember@test.com',
        name: 'Demo Guild Member',
        role: 'member' as const,
        memberId: memberIds.get('m-01') ?? null,
      },
      {
        email: 'officer@test.com',
        name: 'Demo Officer',
        role: 'admin' as const,
        memberId: memberIds.get('m-02') ?? null,
      },
    ];
    for (const u of users) {
      let authUserId = await signUpUpstream(base, u.email, password, u.name);
      if (!authUserId) authUserId = await signInUpstream(base, u.email, password);
      if (!authUserId) throw new Error(`Could not create or find ${u.email} upstream`);
      await d
        .insert(t.appUsers)
        .values({ authUserId, email: u.email, name: u.name, role: u.role, memberId: u.memberId })
        .onConflictDoUpdate({
          target: t.appUsers.authUserId,
          set: { role: u.role, memberId: u.memberId, name: u.name },
        });
      console.log(`test user ${u.email} (${u.role}) password ${password}`);
    }
  }

  /* first admin invitation */
  const adminEmail = opt('--admin');
  if (adminEmail) {
    const token = makeToken();
    await d.insert(t.invitations).values({
      email: adminEmail.toLowerCase(),
      name: null,
      role: 'admin',
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    console.log(
      `admin invitation for ${adminEmail}: ${process.env.PUBLIC_SITE_URL ?? 'http://localhost:8888'}/invite/${token}`,
    );
  }

  console.log('done');
}

/** Better Auth: POST /sign-up/email. Returns the user id, or null if the user exists. */
async function signUpUpstream(
  base: string,
  email: string,
  password: string,
  name: string,
): Promise<string | null> {
  const res = await fetch(`${base}/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:8888' },
    body: JSON.stringify({ email, password, name }),
  });
  if (res.ok) {
    const j = (await res.json()) as { user?: { id: string } };
    return j.user?.id ?? null;
  }
  const text = await res.text();
  if (/exist/i.test(text)) return null;
  throw new Error(`sign-up failed (${res.status}): ${text}`);
}

async function signInUpstream(
  base: string,
  email: string,
  password: string,
): Promise<string | null> {
  const res = await fetch(`${base}/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:8888' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { user?: { id: string } };
  return j.user?.id ?? null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
