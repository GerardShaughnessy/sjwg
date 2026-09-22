import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ enums */
export const userRole = pgEnum('user_role', ['admin', 'member']);
export const availability = pgEnum('availability', ['available', 'limited', 'unavailable']);
export const requestStatus = pgEnum('request_status', ['open', 'claimed', 'referred', 'closed']);
export const urgency = pgEnum('urgency', ['can-wait', 'getting-worse', 'no-heat-or-water']);
export const requestSource = pgEnum('request_source', ['web', 'seed', 'manual']);
export const noteAuthor = pgEnum('note_author', ['requester', 'member']);
export const actorKind = pgEnum('actor_kind', ['requester', 'member', 'system']);
export const requestAction = pgEnum('request_action', [
  'created',
  'claimed',
  'referred',
  'closed',
  'reopened',
  'note_added',
  'photo_added',
  'email_sent',
]);
export const eventKind = pgEnum('event_kind', [
  'mass',
  'meeting',
  'retreat',
  'procession',
  'workday',
  'party',
  'other',
]);
export const postStatus = pgEnum('post_status', ['draft', 'published']);
export const sponsorTier = pgEnum('sponsor_tier', ['partner', 'sponsor', 'supporter', 'in-kind']);
export const giftMethod = pgEnum('gift_method', ['card', 'check', 'cash', 'ach', 'other']);
export const ackStatus = pgEnum('ack_status', ['not_required', 'pending_review', 'sent', 'manual']);
export const formKind = pgEnum('form_kind', ['contact', 'partner', 'membership']);
export const emailStatus = pgEnum('email_status', ['sent', 'failed', 'skipped']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/* ---------------------------------------------------------------- members */
export const members = pgTable(
  'members',
  {
    id: id(),
    legacyId: text('legacy_id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    trade: text('trade').notNull(),
    areas: text('areas')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    yearsInTrade: integer('years_in_trade').notNull().default(0),
    bio: text('bio').notNull().default(''),
    availability: availability('availability').notNull().default('available'),
    featured: boolean('featured').notNull().default(false),
    /** Consent gate. Only public rows are prerendered into the directory. */
    public: boolean('public').notNull().default(false),
    photoKey: text('photo_key'),
    privatePhone: text('private_phone'),
    privateEmail: text('private_email'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('members_slug_idx').on(t.slug),
    uniqueIndex('members_legacy_id_idx').on(t.legacyId),
    index('members_public_idx').on(t.public, t.featured),
  ],
);

/* -------------------------------------------------------------- app users */
export const appUsers = pgTable(
  'app_users',
  {
    id: id(),
    /** Better Auth user id in neon_auth.user. No FK: Neon owns that schema. */
    authUserId: text('auth_user_id').notNull(),
    email: text('email').notNull(),
    name: text('name'),
    role: userRole('role').notNull().default('member'),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
    disabled: boolean('disabled').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('app_users_auth_user_id_idx').on(t.authUserId),
    uniqueIndex('app_users_email_idx').on(sql`lower(${t.email})`),
    index('app_users_member_id_idx').on(t.memberId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name'),
    role: userRole('role').notNull().default('member'),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => appUsers.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    authUserId: text('auth_user_id'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invitations_token_hash_idx').on(t.tokenHash),
    index('invitations_email_idx').on(sql`lower(${t.email})`),
  ],
);

/* --------------------------------------------------------------- requests */
export const requests = pgTable(
  'requests',
  {
    id: id(),
    ref: text('ref').notNull(),
    status: requestStatus('status').notNull().default('open'),
    trade: text('trade').notNull(),
    tradeSlug: text('trade_slug').notNull(),
    description: text('description').notNull(),
    urgency: urgency('urgency').notNull().default('can-wait'),
    zip: text('zip').notNull().default(''),
    neighborhood: text('neighborhood').notNull().default(''),
    contactName: text('contact_name').notNull(),
    contactPhone: text('contact_phone').notNull().default(''),
    contactEmail: text('contact_email').notNull().default(''),
    bestTime: text('best_time').notNull().default(''),
    trackingTokenHash: text('tracking_token_hash').notNull(),
    /** AES-GCM copy so later emails can carry the requester's link. */
    trackingTokenEnc: text('tracking_token_enc'),
    claimedBy: uuid('claimed_by').references(() => members.id, { onDelete: 'set null' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    referralNote: text('referral_note'),
    source: requestSource('source').notNull().default('web'),
    ipHash: text('ip_hash'),
    confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
    intakeNotifiedAt: timestamp('intake_notified_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('requests_ref_idx').on(t.ref),
    uniqueIndex('requests_tracking_idx').on(t.trackingTokenHash),
    index('requests_status_created_idx').on(t.status, t.createdAt),
  ],
);

export const requestPhotos = pgTable(
  'request_photos',
  {
    id: id(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    blobKey: text('blob_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    originalName: text('original_name'),
    createdAt: createdAt(),
  },
  (t) => [index('request_photos_request_idx').on(t.requestId)],
);

export const requestNotes = pgTable(
  'request_notes',
  {
    id: id(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    authorKind: noteAuthor('author_kind').notNull(),
    authorUserId: uuid('author_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
    authorName: text('author_name'),
    body: text('body').notNull(),
    visibleToRequester: boolean('visible_to_requester').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('request_notes_request_idx').on(t.requestId, t.createdAt)],
);

export const requestEvents = pgTable(
  'request_events',
  {
    id: id(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    actorKind: actorKind('actor_kind').notNull(),
    actorUserId: uuid('actor_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
    actorName: text('actor_name'),
    action: requestAction('action').notNull(),
    fromStatus: requestStatus('from_status'),
    toStatus: requestStatus('to_status'),
    detail: jsonb('detail'),
    createdAt: createdAt(),
  },
  (t) => [index('request_events_request_idx').on(t.requestId, t.createdAt)],
);

/* ----------------------------------------------------------------- events */
export const events = pgTable(
  'events',
  {
    id: id(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    kind: eventKind('kind').notNull().default('other'),
    start: timestamp('start', { withTimezone: true }).notNull(),
    end: timestamp('end', { withTimezone: true }),
    location: text('location').notNull().default(''),
    summary: text('summary').notNull().default(''),
    body: text('body').notNull().default(''),
    membersOnly: boolean('members_only').notNull().default(false),
    published: boolean('published').notNull().default(true),
    tk: text('tk'),
    createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('events_slug_idx').on(t.slug), index('events_start_idx').on(t.start)],
);

export const eventReminderPrefs = pgTable('event_reminder_prefs', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  email: boolean('email').notNull().default(false),
  /** Stored now, sent in a later round once texting is registered. */
  sms: boolean('sms').notNull().default(false),
  phone: text('phone').notNull().default(''),
  updatedAt: updatedAt(),
});

export const eventRemindersSent = pgTable(
  'event_reminders_sent',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUsers.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull().default('email'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId, t.channel] })],
);

/* ------------------------------------------------------------------ posts */
export const posts = pgTable(
  'posts',
  {
    id: id(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    bodyMd: text('body_md').notNull().default(''),
    authorName: text('author_name').notNull().default(''),
    authorUserId: uuid('author_user_id').references(() => appUsers.id, { onDelete: 'set null' }),
    status: postStatus('status').notNull().default('draft'),
    pubDate: timestamp('pub_date', { withTimezone: true }),
    updatedDate: timestamp('updated_date', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('posts_slug_idx').on(t.slug),
    index('posts_status_idx').on(t.status, t.pubDate),
  ],
);

/* --------------------------------------------------------------- sponsors */
export const sponsors = pgTable(
  'sponsors',
  {
    id: id(),
    name: text('name').notNull(),
    url: text('url').notNull().default(''),
    tier: sponsorTier('tier').notNull().default('sponsor'),
    logoKey: text('logo_key'),
    logoAlt: text('logo_alt').notNull().default(''),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sponsors_active_idx').on(t.active, t.sortOrder)],
);

/* -------------------------------------------------------------- donations */
export const donors = pgTable(
  'donors',
  {
    id: id(),
    name: text('name').notNull(),
    email: text('email'),
    stripeCustomerId: text('stripe_customer_id'),
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('donors_stripe_customer_idx').on(t.stripeCustomerId),
    uniqueIndex('donors_email_idx')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} is not null`),
  ],
);

export const givingTiers = pgTable('giving_tiers', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  minCents: integer('min_cents').notNull(),
  benefits: text('benefits')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /** Fair market value of the benefits. NULL until an accountant sets it. */
  fmvCents: integer('fmv_cents'),
  fmvReviewedAt: timestamp('fmv_reviewed_at', { withTimezone: true }),
  fmvNote: text('fmv_note'),
  sort: integer('sort').notNull().default(0),
});

export const donations = pgTable(
  'donations',
  {
    id: id(),
    donorId: uuid('donor_id').references(() => donors.id, { onDelete: 'set null' }),
    donorName: text('donor_name').notNull(),
    donorEmail: text('donor_email'),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    method: giftMethod('method').notNull().default('card'),
    fund: text('fund').notNull().default('general'),
    tier: text('tier'),
    recurring: boolean('recurring').notNull().default(false),
    interval: text('interval'),
    receivedAt: date('received_at').notNull(),
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeInvoiceId: text('stripe_invoice_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    fmvCents: integer('fmv_cents'),
    deductibleCents: integer('deductible_cents'),
    ackStatus: ackStatus('ack_status').notNull().default('pending_review'),
    ackSentAt: timestamp('ack_sent_at', { withTimezone: true }),
    enteredBy: uuid('entered_by').references(() => appUsers.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('donations_payment_intent_idx').on(t.stripePaymentIntentId),
    uniqueIndex('donations_invoice_idx').on(t.stripeInvoiceId),
    index('donations_received_idx').on(t.receivedAt),
    index('donations_donor_idx').on(t.donorId),
  ],
);

export const stripeEvents = pgTable(
  'stripe_events',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    payload: jsonb('payload'),
  },
  (t) => [index('stripe_events_unprocessed_idx').on(t.processedAt)],
);

/* ------------------------------------------------------------------ forms */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: id(),
    kind: formKind('kind').notNull(),
    payload: jsonb('payload').notNull(),
    email: text('email'),
    name: text('name'),
    ipHash: text('ip_hash'),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('form_submissions_kind_idx').on(t.kind, t.createdAt)],
);

/* ------------------------------------------------------------ email + misc */
export const emailLog = pgTable(
  'email_log',
  {
    id: id(),
    toEmail: text('to_email').notNull(),
    template: text('template').notNull(),
    subject: text('subject').notNull(),
    providerId: text('provider_id'),
    status: emailStatus('status').notNull(),
    error: text('error'),
    relatedType: text('related_type'),
    relatedId: text('related_id'),
    createdAt: createdAt(),
  },
  (t) => [index('email_log_created_idx').on(t.createdAt)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
  updatedAt: updatedAt(),
});
