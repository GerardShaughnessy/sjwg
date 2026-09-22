CREATE TYPE "public"."ack_status" AS ENUM('not_required', 'pending_review', 'sent', 'manual');--> statement-breakpoint
CREATE TYPE "public"."actor_kind" AS ENUM('requester', 'member', 'system');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('available', 'limited', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('mass', 'meeting', 'retreat', 'procession', 'workday', 'party', 'other');--> statement-breakpoint
CREATE TYPE "public"."form_kind" AS ENUM('contact', 'partner', 'membership');--> statement-breakpoint
CREATE TYPE "public"."gift_method" AS ENUM('card', 'check', 'cash', 'ach', 'other');--> statement-breakpoint
CREATE TYPE "public"."note_author" AS ENUM('requester', 'member');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."request_action" AS ENUM('created', 'claimed', 'referred', 'closed', 'reopened', 'note_added', 'photo_added', 'email_sent');--> statement-breakpoint
CREATE TYPE "public"."request_source" AS ENUM('web', 'seed', 'manual');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'claimed', 'referred', 'closed');--> statement-breakpoint
CREATE TYPE "public"."sponsor_tier" AS ENUM('partner', 'sponsor', 'supporter', 'in-kind');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('can-wait', 'getting-worse', 'no-heat-or-water');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"member_id" uuid,
	"disabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid,
	"donor_name" text NOT NULL,
	"donor_email" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"method" "gift_method" DEFAULT 'card' NOT NULL,
	"fund" text DEFAULT 'general' NOT NULL,
	"tier" text,
	"recurring" boolean DEFAULT false NOT NULL,
	"interval" text,
	"received_at" date NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_invoice_id" text,
	"stripe_subscription_id" text,
	"fmv_cents" integer,
	"deductible_cents" integer,
	"ack_status" "ack_status" DEFAULT 'pending_review' NOT NULL,
	"ack_sent_at" timestamp with time zone,
	"entered_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"stripe_customer_id" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"provider_id" text,
	"status" "email_status" NOT NULL,
	"error" text,
	"related_type" text,
	"related_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reminder_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reminders_sent" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_reminders_sent_event_id_user_id_channel_pk" PRIMARY KEY("event_id","user_id","channel")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"kind" "event_kind" DEFAULT 'other' NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone,
	"location" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"members_only" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"tk" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "form_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"email" text,
	"name" text,
	"ip_hash" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giving_tiers" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_cents" integer NOT NULL,
	"benefits" text[] DEFAULT '{}'::text[] NOT NULL,
	"fmv_cents" integer,
	"fmv_reviewed_at" timestamp with time zone,
	"fmv_note" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"member_id" uuid,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"opened_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"auth_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"trade" text NOT NULL,
	"areas" text[] DEFAULT '{}'::text[] NOT NULL,
	"years_in_trade" integer DEFAULT 0 NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"availability" "availability" DEFAULT 'available' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"photo_key" text,
	"private_phone" text,
	"private_email" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_user_id" uuid,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"pub_date" timestamp with time zone,
	"updated_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text,
	"action" "request_action" NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status",
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_kind" "note_author" NOT NULL,
	"author_user_id" uuid,
	"author_name" text,
	"body" text NOT NULL,
	"visible_to_requester" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"blob_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"trade" text NOT NULL,
	"trade_slug" text NOT NULL,
	"description" text NOT NULL,
	"urgency" "urgency" DEFAULT 'can-wait' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"neighborhood" text DEFAULT '' NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"best_time" text DEFAULT '' NOT NULL,
	"tracking_token_hash" text NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"referral_note" text,
	"source" "request_source" DEFAULT 'web' NOT NULL,
	"ip_hash" text,
	"confirmation_sent_at" timestamp with time zone,
	"intake_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"tier" "sponsor_tier" DEFAULT 'sponsor' NOT NULL,
	"logo_key" text,
	"logo_alt" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_entered_by_app_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminder_prefs" ADD CONSTRAINT "event_reminder_prefs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders_sent" ADD CONSTRAINT "event_reminders_sent_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reminders_sent" ADD CONSTRAINT "event_reminders_sent_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_app_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_user_id_app_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_actor_user_id_app_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_notes" ADD CONSTRAINT "request_notes_author_user_id_app_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_photos" ADD CONSTRAINT "request_photos_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_claimed_by_members_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_auth_user_id_idx" ON "app_users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_email_idx" ON "app_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "app_users_member_id_idx" ON "app_users" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_payment_intent_idx" ON "donations" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_invoice_idx" ON "donations" USING btree ("stripe_invoice_id");--> statement-breakpoint
CREATE INDEX "donations_received_idx" ON "donations" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "donations_donor_idx" ON "donations" USING btree ("donor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donors_stripe_customer_idx" ON "donors" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "donors_email_idx" ON "donors" USING btree (lower("email")) WHERE "donors"."email" is not null;--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_start_idx" ON "events" USING btree ("start");--> statement-breakpoint
CREATE INDEX "form_submissions_kind_idx" ON "form_submissions" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "members_slug_idx" ON "members" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "members_legacy_id_idx" ON "members" USING btree ("legacy_id");--> statement-breakpoint
CREATE INDEX "members_public_idx" ON "members" USING btree ("public","featured");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status","pub_date");--> statement-breakpoint
CREATE INDEX "request_events_request_idx" ON "request_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_notes_request_idx" ON "request_notes" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_photos_request_idx" ON "request_photos" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_ref_idx" ON "requests" USING btree ("ref");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_tracking_idx" ON "requests" USING btree ("tracking_token_hash");--> statement-breakpoint
CREATE INDEX "requests_status_created_idx" ON "requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sponsors_active_idx" ON "sponsors" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "stripe_events_unprocessed_idx" ON "stripe_events" USING btree ("processed_at");