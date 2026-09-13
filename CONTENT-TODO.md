# Content to supply before launch

Everything in this file is either fictional sample copy, a missing asset, or a seam where a real system attaches. The site reads as finished on purpose, so this list is the only record of what is not real. Sample copy on the live pages has a dotted brass underline; hover it to see what real fact it stands in for.

## 1. Sample copy standing in for real facts

All defined in `src/config/site.ts` under `TK`, rendered through `src/components/ui/Tk.astro` (or the `Sample` helper in `src/components/request/RequestWizard.tsx`). Each has `data-tk="<what is needed>"` in the HTML.

| Key                  | Where it appears                      | Sample shown now                                              | Real fact needed                                                                                                                   |
| -------------------- | ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `streetAddress`      | Footer, home "Where we meet", contact | 744 South Third Street                                        | Street address of Saint Mary of Victories. Verify; this is from memory, not from the Guild                                         |
| `zip`                | Footer, home, contact                 | 63102                                                         | Parish zip code. Verify                                                                                                            |
| `mailingAddress`     | Footer, donate                        | P.O. Box 4200, St. Louis, MO 63102                            | Mailing address for the Guild                                                                                                      |
| `meetingSchedule`    | Home "Where we meet"                  | First Saturday Mass 8:00 AM; third Thursday formation 7:00 PM | Actual meeting day, time, and room                                                                                                 |
| `taxStatus`          | Footer, first-visit notice            | A 501(c)(3) nonprofit. EIN 00-0000000                         | Legal status line and EIN. The Case for Support does not state either                                                              |
| `phone`              | Contact                               | (314) 555-0147                                                | Guild phone number                                                                                                                 |
| `email`              | Contact                               | hello@sjwguild.org                                            | Guild email address                                                                                                                |
| `responseCommitment` | Request confirmation                  | Call within two business days; same day if urgent             | What actually happens after a request comes in, and how fast. Do not publish a promise the Guild cannot keep                       |
| `serviceArea`        | Request step 4                        | St. Louis area, both sides of the river                       | Whether the Guild has a service-area boundary                                                                                      |
| `promoVideo`         | Hero caption                          | "Promo video coming soon."                                    | The promo video file (mp4 and webm) and a poster still. Set `data-src-mp4` and `data-src-webm` in `src/components/home/Hero.astro` |
| `partnershipContact` | Contact, partner form confirmation    | Daniel Kovach, secretary                                      | Who handles partnership inquiries                                                                                                  |
| `legalName`          | Donate, by check                      | St. Joseph the Worker Guild                                   | Legal name checks should be made out to                                                                                            |
| `dues`               | Get involved                          | $35 a month or $400 a year                                    | Dues amount. The board has not set it; the $500/yr figure in the pro forma is derived, not decided                                 |
| `leadership`         | About                                 | Thomas Reilly, Daniel Kovach, Fr. Michael Novak               | Board, officers, chaplain. All three names are fictional                                                                           |
| `whoReplies`         | Contact and membership confirmations  | A Guild officer replies within two business days              | Who reads the forms and the real response time                                                                                     |
| `volunteerRoles`     | Get involved                          | Work-day crews, procession setup, Christmas party kitchen     | Actual volunteer roles and coordinator                                                                                             |
| `fundingGoalPeriod`  | Donate                                | "first year"                                                  | The Case for Support says first year; every deck and the pro forma say first six months. Needs a decision                          |
| `onlineGiving`       | Donate                                | "Online giving opens soon."                                   | Donation processor and hosted giving URL. See `DONOR-SYSTEM-OPTIONS.md`. Set `DONATE_URL` in `src/config/site.ts`                  |
| `parishGiving`       | Donate                                | Link text to a parish giving page                             | Whether the church-direct giving page exists, and its URL                                                                          |
| `giftInPerson`       | Donate                                | Hand it to an officer or the usher                            | Who receives gifts in person                                                                                                       |
| `consentCases`       | About, "Why a guild is needed"        | "Names withheld at the members' request."                     | Written consent from both members before either hardship case is attributed. Currently anonymous, which is fine to keep            |

## 2. Other sample copy not driven by the `TK` map

- **Testimonials** (`src/components/home/Testimonials.astro`): the three quotes and attributions come from the Case for Support (James Hooper, Milton Weis, Jake Benedick). The attributions were in square brackets in the source. Confirm each person consents to publication and the wording of his title.
- **Blog posts** (`src/content/blog/*.md`): authors "Thomas Reilly, president" and "Daniel Kovach, secretary" are fictional. Each post has one or two paragraphs of sample copy where a member's own words belong. Replace or delete.
- **Events** (`src/data/events.json`): every date, time, venue, cost, and celebrant is sample. The Christmas party was mentioned in conversation and does not appear in the Case for Support; confirm it exists. Retreat cost $180 and party cost $15 are invented.
- **Member directory** (`src/data/members.json`): all 14 members are fictional with placeholder surnames (Sampleton, Placeholder, Mockwell). Replace wholesale. Real members named in the Case for Support (Greg, Sam, Milton, Jake) are the first candidates. What appears publicly for a real person (phone, last name, exact area, photo) is a consent question, not a design question. The directory banner and the home strip note say "sample" until then.
- **Sample requests** (`src/data/sample-requests.json`) and **donations** (`src/data/donations.json`): fictional, for the portal demo only.
- **Demo accounts** (`src/config/site.ts`): `guildmember@test.com` and `customer@test.com`, password `guild2026`. Remove when real auth exists.
- **Founder**: the founding story does not name the plumber. Decide whether he wants to be named.
- **Hero eyebrow and dialog copy** describe the Guild as "Catholic tradesmen of Saint Mary of Victories" and "a nonprofit". Both are from the Guild's material; only the tax status line is sample.

## 3. Image slots

Defined in `src/data/images.ts`. Stock files are in `src/assets/stock/` with source and license in `stock-credits.json`. Anything with the `stock-` prefix is a placeholder to swap for Guild photography (GS Photos). A `null` slot renders a labeled grey region.

| Slot             | Current                                                                        | Wanted                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `heroPoster`     | Stock: pipe wrenches on a galvanized pipe (Pixabay, stevepb)                   | Poster still from the promo video, or a Guild member at work                                                     |
| `guildAtWork`    | Placeholder region                                                             | A Guild tradesman shaking hands with a homeowner at the front door after a repair. No good stock match was found |
| `foundingStory`  | Placeholder region                                                             | A plumber's work van at the curb of a small, weathered house                                                     |
| `spiritual`      | Stock: man kneeling in an empty church (Pixabay)                               | Guild members at the monthly Mass or adoration                                                                   |
| `electrician`    | Stock: hands in an open panel (Pixabay, Sid74). Not currently placed on a page | A member electrician at work                                                                                     |
| `carpenter`      | Stock: hand plane on a bench (Pixabay). On Get involved                        | A member carpenter or woodworker at work                                                                         |
| `meetingPlace`   | Placeholder region                                                             | Exterior of Saint Mary of Victories. Deliberately not stock: a wrong church would mislead                        |
| `memberPortrait` | Not used yet; directory rows show initials                                     | A portrait for each member, with consent                                                                         |

Also wanted: before-and-after photos of the parish jobs (the decks ask for these twice), and photographs of completed work generally.

## 4. Donate URL

`DONATE_URL` in `src/config/site.ts` is `#donate-placeholder`, which scrolls to the "How to give" section. Replace with the hosted giving page once a processor is chosen. Every donate button on the site reads from this one constant.

## 5. Backend seams

Every `// BACKEND:` comment in the code. All but two are in `src/lib/store.ts`.

| File                                   | Seam                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/store.ts` (`auth`)            | Replace demo login with a real auth provider (Netlify Identity, Clerk, Supabase Auth). Role comes from the user record       |
| `src/lib/store.ts` (`requests.create`) | POST the request to an API, persist it, notify the Guild's intake contact by email or text. Reference number from the server |
| `src/lib/store.ts` (`requests.update`) | Status changes server-side and audited                                                                                       |
| `src/lib/store.ts` (`posts`)           | Git-based CMS (Decap) or a posts table; publishing writes markdown into `src/content/blog`                                   |
| `src/lib/store.ts` (`reminders`)       | Email provider and Twilio for texts; scheduled reminder jobs                                                                 |
| `src/lib/store.ts` (`profile`)         | Members table; a member edits only his own row; public fields gated by consent                                               |
| `src/lib/store.ts` (`donations`)       | Stripe and a donor CRM synced to QuickBooks. See `DONOR-SYSTEM-OPTIONS.md`                                                   |
| `src/lib/store.ts` (`forms`)           | Netlify Forms for contact, partner, and membership forms                                                                     |
| `src/content.config.ts`                | Where a CMS would write blog markdown                                                                                        |
| `src/config/site.ts`                   | Demo accounts to remove                                                                                                      |
| `astro.config.mjs`                     | Set `site` to the real domain                                                                                                |

Photo upload in the request wizard keeps the file in memory and shows a preview only; a real implementation needs object storage with a signed upload URL.

## 6. Legal and accounting items surfaced by the content

- The giving-level benefits (crucifix, key holder, pro bono labor, retreat) are quid pro quo benefits. An accountant must review them for their effect on the deductible portion of a gift before receipts go out. The decks flag this twice.
- The 100% lead-to-close rate from the decks is left off the site because it has no denominator. The "$5,000+ saved" and "30+ jobs" figures are used.
- The fatal-injury statistic is the BLS occupation-group figure and is labeled so on the About page. Do not restate it as an industry figure.
- The v1 deck claim that a guild "has never been rebuilt in St. Louis" was removed in v2 and is not used.

## 7. Not built on purpose

- No real login, database, email, texting, payments, or CMS. See the README for what attaches where.
- No map embed on "Where we meet"; it links to a maps search instead.
- The portal route cannot be protected on a static host. It is `noindex` and gated client-side only.
