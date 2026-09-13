# St. Joseph the Worker Guild website

Public website for the St. Joseph the Worker Guild (SJWG), a Catholic fraternal organization for tradesmen based at Saint Mary of Victories in St. Louis, Missouri.

This is a **stage one and two mockup**: design and in-browser function. Everything works with no server. Nothing is sent anywhere, nothing is persisted beyond the visitor's own browser, there is no real login. Every place a backend would attach is marked `// BACKEND:` in the code and listed in `CONTENT-TODO.md`.

## Run it

```
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve dist/
npm run check      # astro check (types)
npm test           # vitest (lib helpers and the faked store)
npm run lh         # Lighthouse CI against dist/ (needs a build first)
```

Node 22 or newer. Astro 7 runs the dev server as a daemon: `npx astro dev stop` stops it.

## What is on the site

| Route                       | What it is                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | Hero with promo-video slot, what the Guild is, four pillars, founding story, member strip, how to help, testimonials, events and blog previews, where we meet |
| `/directory`                | Member directory. Filter by trade and area, sort, URL-synced. Sample data. The QR-code landing page for business cards; `/hire` redirects here                |
| `/request`                  | Five-question request-help wizard with a confirmation and reference number. Never mentions money                                                              |
| `/events`, `/events/[slug]` | Upcoming and past events with detail pages                                                                                                                    |
| `/about`                    | What a guild is, why one is needed, the five program areas, values, where the Guild is headed                                                                 |
| `/get-involved`             | Join as a tradesman (interest form), volunteer, partner, hire                                                                                                 |
| `/donate`                   | Where a gift goes, five giving levels, how to give, church-direct giving, partner with the Guild                                                              |
| `/contact`                  | Contact form and a partnership form                                                                                                                           |
| `/blog`, `/blog/[id]`       | Markdown posts from `src/content/blog`                                                                                                                        |
| `/login`, `/portal`         | Faked portal. Member: job board, calendar with reminders, own directory entry, blog drafts, donor records with CSV export. Customer: their requests           |

Demo accounts: `guildmember@test.com` and `customer@test.com`, password `guild2026`.

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

## What is faked, and where the real thing attaches

Everything below lives behind one file, `src/lib/store.ts`. Each namespace has a `// BACKEND:` comment.

| Faked                              | How                                                                                      | Real implementation                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Login                              | Two demo accounts, session in localStorage                                               | Netlify Identity, Clerk, or Supabase Auth; role from the user record                                                   |
| Help requests                      | Seeded from `src/data/sample-requests.json` into localStorage; wizard submissions append | POST to an API, store in Postgres (Neon), notify the intake contact by email or text. Reference number from the server |
| Blog drafts                        | localStorage                                                                             | Decap CMS writing markdown into `src/content/blog`, or a posts table                                                   |
| Event reminders                    | Preference saved to localStorage                                                         | Email provider plus Twilio for texts, with scheduled jobs                                                              |
| Directory entry edits              | Overrides in localStorage on top of `members.json`                                       | Members table; the member edits only his own row                                                                       |
| Donor records                      | `src/data/donations.json`, CSV export client-side                                        | Stripe plus a donor CRM (Little Green Light or Eleo) synced to QuickBooks. See `DONOR-SYSTEM-OPTIONS.md`               |
| Contact, partner, membership forms | Saved to localStorage after a delay                                                      | Netlify Forms is the cheapest attach point on a static host                                                            |
| Photo upload                       | Local preview only, bytes never leave the device                                         | Object storage with a signed upload URL                                                                                |
| Donate button                      | `DONATE_URL` in `src/config/site.ts` points to an in-page anchor                         | Set to the hosted giving page once a processor is chosen                                                               |

The portal route is `noindex` and cannot be protected on a static host; the gate is client-side only.

## Content

- `src/data/members.json` is the only source for the directory, the home page strip, and the request flow's trade list. Members are fictional with obviously placeholder names.
- `src/data/events.json` and `src/content/blog/*.md` hold events and posts. Sample copy is marked in `CONTENT-TODO.md`.
- `src/data/images.ts` maps every image slot to a file and alt text. Stock photos are in `src/assets/stock/` with credits in `stock-credits.json`; a `null` slot renders a labeled placeholder region.
- `src/config/site.ts` holds every sample value (`TK`) with the real fact it stands in for.

## Deploy

Static output, no adapter. `netlify.toml` sets the build command, publish directory, Node 22, security headers, and the `/hire` redirect.

- Connected to GitHub: push to `main` and Netlify builds.
- By CLI: `npx netlify deploy --prod --build`.

Set `site` in `astro.config.mjs` to the real domain when there is one, so canonical URLs and the sitemap are right.
