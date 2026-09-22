# St. Joseph the Worker Guild website

Public website and member portal for the St. Joseph the Worker Guild (SJWG), a Catholic fraternal organization for tradesmen based at Saint Mary of Victories in St. Louis, Missouri.

Stage three: the site is real. Public pages are prerendered from a Postgres database, the portal has real logins, help requests and forms are stored and emailed, gifts run through Stripe, and content is edited in the portal. One operator (Gerard) runs it; the stack is chosen so it costs a few dollars a month and no Guild officer needs a vendor dashboard.

## Run it

```
npm install
cp .env.example .env     # then fill it in (see Environment below)
npm run dev              # netlify dev on http://localhost:8888 (functions, Blobs, .env)
npm run build            # static pages + one Netlify function for the on-demand routes
npm run check            # astro check (types)
npm test                 # vitest
npm run lh               # Lighthouse CI against dist/ (build first)
npm run db:generate      # drizzle-kit: new migration from src/server/db/schema.ts
npm run db:migrate       # apply migrations to DATABASE_URL
npm run db:seed          # sample content; add --with-test-users on the dev branch
```

Node 22 or newer. `npm run dev` sets `ASTRO_DEV_BACKGROUND=1` because Astro 7 otherwise backgrounds itself under an AI agent and `netlify dev` exits. If a build or the dev server gets stale after adding a dependency: `npx astro dev stop && rm -rf node_modules/.vite && npm run dev`.

For Stripe locally: `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,invoice.paid,invoice.payment_failed --forward-to localhost:8888/api/webhooks/stripe` and put the printed `whsec_` in `.env`.

## What is on the site

| Route                       | What it is                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | Hero with promo-video slot, what the Guild is, four pillars, founding story, member strip, how to help, testimonials, events and blog previews, where we meet                                                                          |
| `/directory`                | Member directory. Filter by trade and area, sort, URL-synced. Sample data. The QR-code landing page for business cards; `/hire` redirects here                                                                                         |
| `/request`                  | Five-question request-help wizard with a confirmation and reference number. Never mentions money                                                                                                                                       |
| `/events`, `/events/[slug]` | Upcoming and past events with detail pages                                                                                                                                                                                             |
| `/about`                    | What a guild is, why one is needed, the five program areas, values, where the Guild is headed                                                                                                                                          |
| `/get-involved`             | Join as a tradesman (interest form), volunteer, partner, hire                                                                                                                                                                          |
| `/donate`                   | Where a gift goes, five giving levels, how to give, church-direct giving, partner with the Guild                                                                                                                                       |
| `/contact`                  | Contact form and a partnership form                                                                                                                                                                                                    |
| `/blog`, `/blog/[id]`       | Markdown posts from `src/content/blog`                                                                                                                                                                                                 |
| `/login`, `/portal`         | Member portal. Members: job board with referrals, calendar with email reminders, own directory entry and photo, blog drafts. Officers also: events, sponsors, donor records, invitations, every member entry, and email to all members |
| `/request/track/[token]`    | A requester's private status page, linked from the confirmation email                                                                                                                                                                  |
| `/invite/[token]`           | Set a password from an officer's invitation. There is no public sign-up                                                                                                                                                                |
| `/donate/thank-you`         | After Stripe Checkout                                                                                                                                                                                                                  |
| `/api/*`                    | JSON routes behind the portal and the public forms; `/api/webhooks/stripe` records gifts                                                                                                                                               |

Logins are invite-only. On the Neon `dev` branch the seed creates `guildmember@test.com` (member) and `officer@test.com` (officer), password `guild2026-dev`. Production accounts come only from invitations.

## Design plan

### Palette

Taken verbatim from the Guild's donor decks so the site matches what donors have already seen.

| Name     | Hex       | Role                                                                                                         | Contrast                             |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Brick    | `#8C3A2E` | The one bold element: page-header bands, primary buttons                                                     | 6.4:1 on Stone; white on Brick 7.6:1 |
| Kiln     | `#5F2419` | Brick hover and pressed                                                                                      |                                      |
| Brass    | `#B08D57` | Hairline rules, small labels on dark bands, focus ring, the wordmark's rule. Never body text on light ground | 4.8:1 on Charcoal (large text only)  |
| Charcoal | `#2B2624` | Body text, dark bands                                                                                        |                                      |
| Ash      | `#6E6560` | Secondary text                                                                                               | 4.8:1 on Stone                       |
| Stone    | `#EFEAE4` | Page ground. Mortar `#B9AFA8` for borders. White slabs on Stone with hard edges                              |                                      |

Rule: brick appears once per page at scale, plus on primary buttons. Separation comes from background bands and hairline rules, never from rounded corners or shadows.

### Type

- **Libre Caslon Text** for headings, the founding story, and quotes. The standard text face of 19th-century American printing, which is the parish's era.
- **Archivo Variable** for body, UI, forms, and labels. A grotesque with sign-painter proportions; the width axis gives condensed and wide settings from one file.
- Both self-hosted through `@fontsource`. No runtime font requests to third parties.

### Principles

1. **One bold element.** Brick once per page. Everything else is quiet.
2. **Ask first, give second.** The request-help path is the loudest control everywhere. Donate is a firm secondary. The request route never mentions money.
3. **Facts or samples.** Nothing is invented silently. Facts not yet supplied are rendered as sample copy with a dotted brass underline, a tooltip naming the real fact needed, and a `data-tk` attribute, and every one is listed in `CONTENT-TODO.md`.

### Generic defaults that were caught and replaced

| Default                                                | Replaced with                                                                                                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three-column pillars grid with icons on cards          | A two-column ledger with hairline rules, unnumbered                                                                                                        |
| Centered white headline over a darkened autoplay video | Left-aligned Caslon headline in a charcoal band, video as a framed object beside it, poster-only until a file exists, autoplay only when motion is allowed |
| Member cards with rounded photo and "View profile"     | A roster row: square photo, name, trade, area, one line in his own voice, and a link that says what happens                                                |
| Inter and Playfair                                     | Archivo and Libre Caslon Text                                                                                                                              |
| Centered modal with an X                               | A non-modal bottom sheet that never blocks the page, remembered after dismissal, suppressed on the request route                                           |
| Cream page with terracotta accent                      | Limestone-grey ground, brick as structure, brass as hairline                                                                                               |
| Give / Join / Hire as three identical cards            | A brick block, an outlined panel, and a plain list link                                                                                                    |

## What is real, and how it fits

| Piece         | How it works                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Database      | Neon Postgres, project `sjwg`. Branch `main` is production, `dev` is local and preview. Schema in `src/server/db/schema.ts`, migrations in `drizzle/`, applied from a laptop with `npm run db:migrate` (never in a Netlify build).                                                                                                                                                                                                                                             |
| Public pages  | Prerendered at build. `src/content.config.ts` reads members, events, posts, and sponsors from the database and falls back to `src/data/seed/` if it cannot. Publishing from the portal calls the Netlify build hook (coalesced to one every few minutes; `netlify/functions/rebuild-if-pending.mts` flushes hourly).                                                                                                                                                           |
| Logins        | Neon Managed Better Auth, proxied at `/api/auth/*` by `src/pages/api/auth/[...path].ts` with the Astro adapter in `src/server/auth/`. Sign-up is refused unless an opened, unexpired invitation matches; a Better Auth identity without an `app_users` row gets nothing. Roles: `admin` (officers) and `member`.                                                                                                                                                               |
| Help requests | `POST /api/requests` stores the row, a downsized photo in Netlify Blobs, and an audit trail; emails the requester a private tracking link and the Guild an alert. Members claim, refer, close, and note from the job board.                                                                                                                                                                                                                                                    |
| Forms         | Contact, partnership, and membership interest post to `/api/forms/[kind]`, are stored, and emailed to `GUILD_NOTIFY_EMAIL`. Honeypot field drops bots.                                                                                                                                                                                                                                                                                                                         |
| Email         | Resend through `src/server/email/send.ts`; every attempt is logged in `email_log`. Without `RESEND_API_KEY` sends are logged as skipped and nothing else fails.                                                                                                                                                                                                                                                                                                                |
| Gifts         | Stripe hosted Checkout (`/api/donate/checkout`), one-time or monthly. The webhook at `/api/webhooks/stripe` is the only writer of card gifts, idempotent on `stripe_events`. Receipts follow IRS substantiation rules (`src/server/receipts.ts`); levels with benefits wait in "pending review" until an accountant sets the fair market value in `giving_tiers`. Checks and cash are entered by hand in Donor records. The give form appears only when `DONATIONS_LIVE=true`. |
| Uploads       | Netlify Blobs store named by `UPLOADS_STORE` (`uploads` in production, `uploads-dev` elsewhere), served through `/api/files/*`.                                                                                                                                                                                                                                                                                                                                                |
| Reminders     | `netlify/functions/event-reminders.mts` runs daily at 14:00 UTC and emails members who opted in about tomorrow's events (Chicago time). Text reminders are stored, not sent, until texting is registered.                                                                                                                                                                                                                                                                      |

### Environment

Copy `.env.example`. Production values live in Netlify (Site settings, Environment variables) in the `production` context; `deploy-preview` and `branch-deploy` point at the Neon `dev` branch.

| Variable                                                       | What                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                 | Neon pooled connection string for the branch                                                        |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`                | Neon Auth for the branch; the secret is 32+ random characters                                       |
| `PUBLIC_SITE_URL`                                              | Used in emails and Stripe redirects                                                                 |
| `RESEND_API_KEY`, `EMAIL_FROM`                                 | Email. `onboarding@resend.dev` delivers only to the Resend account owner until a domain is verified |
| `GUILD_INTAKE_EMAIL`, `GUILD_NOTIFY_EMAIL`                     | Who gets new requests, and who gets forms and payment failures                                      |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DONATIONS_LIVE` | Stripe. Prefer a restricted key. The give form shows only when `DONATIONS_LIVE=true`                |
| `ORG_LEGAL_NAME`, `ORG_EIN`                                    | Printed on receipts                                                                                 |
| `UPLOADS_STORE`                                                | Blobs store name                                                                                    |
| `NETLIFY_BUILD_HOOK_URL`                                       | Publish hook; without it, content changes wait for the next build                                   |

## Content

- Members, events, posts, and sponsors live in the database and are edited in the portal. `src/data/seed/` holds the fictional sample content the seed script loads and the build falls back to.
- `src/data/images.ts` maps every image slot to a file and alt text. Stock photos are in `src/assets/stock/` with credits in `stock-credits.json`; a `null` slot renders a labeled placeholder region.
- `src/config/site.ts` holds every sample value (`TK`) with the real fact it stands in for.

## Deploy

The Netlify site is connected to this GitHub repo: a push to `main` builds and deploys production. Publishing from the portal calls the "publish" build hook. A manual deploy is `npx netlify deploy --prod --build --context production`. `netlify.toml` sets the build, the scheduled functions, headers, and the `/hire` redirect. Drafts: `npx netlify deploy --build --context deploy-preview`.

Before a schema change reaches production: `DATABASE_URL=<main> npm run db:migrate` from a laptop, then push.

The domain is sjwguild.com, registered at Namecheap with nameservers delegated to Netlify DNS (zone managed in Netlify; it also holds Resend's DKIM, SPF, and DMARC records). `PUBLIC_SITE_URL` is https://sjwguild.com in production and it is a trusted origin in Neon Auth.

## Cost

Netlify Pro (already paid), Neon Launch at about $1 to $4 a month for this load, Neon Auth and Resend on free tiers, Stripe per gift only. See `DONOR-SYSTEM-OPTIONS.md` for the donor CRM question.
