# Donor system options for the Guild

Greg asked: record donor information, take gifts online with the lowest fees, model it on Eleo (he said "elioonline.com", which resolves to an unrelated site; Eleo at eleoonline.com is the donor CRM he means), or Little Green Light, or build our own, and connect to QuickBooks, with taxes handled. This memo compares the real options as of September 2026 and recommends one.

Nothing below is built. The site's donate button points at a placeholder until the board chooses. See `src/config/site.ts` (`DONATE_URL`) and the `// BACKEND:` seam in `src/lib/store.ts` under `donations`.

## What the Guild actually needs

1. Take one-time and recurring gifts online, by card and by bank transfer, at the five giving levels on the donate page.
2. Record every gift, including checks and cash handed over at Mass, against a donor record.
3. Send an acknowledgment and a year-end statement that satisfies IRS substantiation rules for gifts of $250 and up. The tiered benefits (crucifix, key holder, pro bono labor, retreat) are "quid pro quo" benefits. For any gift over $75 where the donor receives goods or services, the receipt must state the fair market value of those benefits and that only the excess is deductible. An accountant must review the tier benefits before receipts go out.
4. Push gifts into QuickBooks so the treasurer is not keying them twice.
5. Let a member with a login see totals and export a CSV (the mock "Donor records" tab shows this).
6. Be cheap. The Guild's first-year goal is $60,000 total. A $500 per year tool is nearly 1% of that.

Prerequisite for everything: confirmed 501(c)(3) determination and an EIN. Zeffy, Stripe's nonprofit rate, and PayPal's nonprofit rate all require it. The status line is still a placeholder on the site.

## The options

| Option             | Monthly cost                                                                                    | Fees on a $100 card gift                                                                                     | Donor CRM                                                     | QuickBooks                                                                     | Receipts and year-end statements                                                                       | Effort to set up                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Zeffy              | $0                                                                                              | $0 to the Guild (donor is asked for an optional tip at checkout)                                             | Basic donor records, tagging, email                           | Export only, no native sync at the time of writing                             | Automatic receipts, year-end statements                                                                | Low. Needs 501(c)(3) proof.                                 |
| Givebutter         | $0 (paid tiers exist)                                                                           | $0 platform fee when donor tips are on, plus 2.9% + $0.30 processing; 3% platform fee if tips are turned off | Real CRM with contacts, tasks, email and texting              | Integration through Zapier; native sync on paid tier                           | Automatic receipts, year-end statements                                                                | Low                                                         |
| Donorbox           | $0 to start; Pro is $150                                                                        | 2.95% platform (1.75% on Pro) plus Stripe or PayPal processing, about $5.45 total                            | CRM add-on                                                    | QuickBooks integration on paid plans                                           | Automatic receipts                                                                                     | Low                                                         |
| Eleo               | $39 for up to 2,500 donor records; every feature included                                       | Depends on the processor you connect (Stripe or similar): 2.2% + $0.30 at Stripe's nonprofit rate            | Full donor CRM: gifts, events, volunteers, grants, mailings   | Yes                                                                            | Yes, with mail merge                                                                                   | Medium. The tool Greg named.                                |
| Little Green Light | $45 for up to 2,500 constituents; unlimited users                                               | Depends on the processor (Stripe, PayPal, ProPay): 2.2% + $0.30 at Stripe's nonprofit rate                   | Full donor CRM                                                | Native QuickBooks Online sync                                                  | Yes                                                                                                    | Medium. The tool the advisors suggested.                    |
| Stripe direct      | $0                                                                                              | 2.2% + $0.30 at the nonprofit rate (apply; requires 501(c)(3))                                               | None. Stripe holds customers and payments only.               | Through a connector app or by export                                           | Stripe emails a payment receipt, not an IRS-style acknowledgment. Year-end statements would be custom. | Medium for Checkout links; high for anything more           |
| Build our own      | $0 to $25 (Neon Postgres free tier, Netlify Functions free tier, an email API) plus Stripe fees | 2.2% + $0.30 at Stripe's nonprofit rate                                                                      | Whatever we build: the mock "Donor records" tab is the sketch | Custom sync via the QuickBooks Online API, which requires app review by Intuit | Custom. Getting substantiation language and quid pro quo disclosure right is our liability.            | High. Weeks of work and ongoing maintenance by a volunteer. |

Fee figures are what the vendors publish for U.S. nonprofits at the time of writing. Verify before signing. On $60,000 of card gifts, the difference between a 0% option and a 2.2% + $0.30 option is roughly $1,500 a year.

## What each one gets wrong for the Guild

- **Zeffy** is the cheapest by a wide margin, but its "free" comes from asking every donor for a tip to Zeffy at checkout, which a $20,000 donor at a dinner may find odd. It is also thin as a CRM and has no native QuickBooks sync. Good for the $25 to $500 levels; awkward for major gifts.
- **Givebutter** is the same tip model with a much better CRM and texting built in, which lines up with Greg's wish to text members and donors. Turning tips off costs 3%.
- **Donorbox** charges the Guild a platform fee on top of processing. Nothing it does is worth that here.
- **Eleo** and **Little Green Light** are the two real donor databases on the list. Both are about $40 to $45 a month, both connect to a processor rather than being one, and both handle receipts, mailings, events, and year-end letters properly. Little Green Light has native QuickBooks Online sync; Eleo's is weaker. Neither is a giving page you would put on a business card; both give you a hosted form to link to.
- **Stripe direct** is the right rails but not a donor system. Someone still has to build or buy the records, receipts, and statements.
- **Custom** is the trap. It looks cheap because the hosting is free, but the Guild would own IRS receipt compliance, QuickBooks API approval, backups, and every bug, and the person who built it may not be a member in three years. The mock donor tab exists to show what it would look like, not to argue for it.

## Recommendation

Two stages, matching the Guild's size.

**Now, before 501(c)(3) is confirmed:** take gifts by check and in person, record them in a spreadsheet the treasurer already keeps, and put the giving-level benefits in front of an accountant for the quid pro quo question. Do not take card payments yet; the nonprofit processing rates and Zeffy's free tier all require the determination letter.

**Once the determination letter is in hand:** run **Stripe as the processor** at the nonprofit rate, and put **Little Green Light** in front of it as the donor system. Reasons:

- It is the cheaper of the two real CRMs to connect to QuickBooks Online, and native sync is what keeps the treasurer from double entry.
- $45 a month with unlimited users means the secretary, treasurer, and president can all be in it.
- It produces IRS-compliant acknowledgments and year-end statements, with a place to record benefit fair market value for the tiered gifts.
- Stripe Checkout links can sit behind the site's "Give now" button with no code. Set `DONATE_URL` in `src/config/site.ts` to the hosted page.
- It handles checks and cash entered by hand, which will be most of the first year's gifts.

If the board prefers Eleo because Greg has seen it, it is a fine second choice at $39 a month; the trade is a weaker QuickBooks path. Zeffy is worth a second look only if fees matter more than a proper CRM and the board is comfortable with the tip prompt.

Revisit custom only if the Guild passes a few thousand donors or needs something the CRM cannot do, and then hire it out rather than volunteer it.

## Taxes, briefly

- Get the 501(c)(3) determination and EIN first; everything hinges on it.
- Register with the Missouri Attorney General's charitable organization registry before soliciting, if required for the Guild's structure (a Missouri attorney should confirm; some religious organizations are exempt).
- Sales tax: Missouri exempts qualifying nonprofits from sales tax on purchases with a state exemption letter. Apply once the determination letter arrives; the tool library and repair-day materials benefit.
- Quid pro quo: any gift over $75 where the donor receives benefits requires a written disclosure of the benefits' fair market value. The Master and Foreman tiers include pro bono labor at the donor's home. An accountant should price that and decide whether to keep it as a benefit.
- 1099s: if the Guild pays a member for work on a client's home out of hardship funds, that is contractor income to the member. QuickBooks handles the 1099 filing; the CRM does not.

## What was built (stage three, September 2026)

- **Stripe hosted Checkout** for one-time and monthly gifts at the five giving levels or any amount, from the give form on `/donate`. No card details touch the site. The webhook at `/api/webhooks/stripe` records every gift once (idempotent on the Stripe event id) and emails a receipt.
- **Receipts** follow IRS substantiation rules: legal name, EIN, 501(c)(3) statement, date, amount, and either "no goods or services" or the fair market value of the benefits with the deductible remainder. Levels with benefits wait in "pending review" until an accountant enters the value in `giving_tiers.fmv_cents`.
- **Donor records** in the portal show every gift, totals by fund and level, receipts to review, manual entry for checks and cash, and a CSV export that matches what QuickBooks Online imports.
- **Still to decide:** the CRM. The recommendation stands: once gifts pass a few dozen donors, add Little Green Light for mailings, year-end statements, and native QuickBooks sync, importing the CSV. The site can keep taking gifts through Stripe either way.
- **Test mode:** the site currently uses a Stripe sandbox (no real money). See `CONTENT-TODO.md` for switching to the Guild's real account and the nonprofit rate.
