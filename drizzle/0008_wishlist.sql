CREATE TABLE "aid_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"applicant_type" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"org_name" text DEFAULT '' NOT NULL,
	"urgency" text NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"award_cents" integer,
	"decision_note" text DEFAULT '' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"ip_hash" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_affirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"signed_date" date NOT NULL,
	"is_catholic" boolean NOT NULL,
	"alignment_note" text DEFAULT '' NOT NULL,
	"terms_version" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"blob_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_on" date,
	"note" text DEFAULT '' NOT NULL,
	"uploaded_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sign_request_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text DEFAULT '' NOT NULL,
	"ip" text,
	"user_agent" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sign_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_kind" text NOT NULL,
	"title" text NOT NULL,
	"frozen_html" text NOT NULL,
	"doc_sha256" text NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text NOT NULL,
	"member_id" uuid,
	"token_hash" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_by" uuid,
	"sent_by_name" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"consent_at" timestamp with time zone,
	"consent_sha256" text,
	"signed_name" text,
	"signed_at" timestamp with time zone,
	"signed_ip" text,
	"signed_user_agent" text,
	"signed_pdf_key" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "show_contact" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aid_applications" ADD CONSTRAINT "aid_applications_decided_by_app_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_app_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_app_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_events" ADD CONSTRAINT "sign_events_sign_request_id_sign_requests_id_fk" FOREIGN KEY ("sign_request_id") REFERENCES "public"."sign_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_requests" ADD CONSTRAINT "sign_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_requests" ADD CONSTRAINT "sign_requests_sent_by_app_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aid_applications_ref_idx" ON "aid_applications" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "aid_applications_status_idx" ON "aid_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "directory_affirmations_email_idx" ON "directory_affirmations" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "sign_events_request_idx" ON "sign_events" USING btree ("sign_request_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_requests_token_idx" ON "sign_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sign_requests_member_idx" ON "sign_requests" USING btree ("member_id");