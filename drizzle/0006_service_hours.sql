CREATE TABLE "service_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_hours" ADD CONSTRAINT "service_hours_logged_by_app_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_hours_member_date_idx" ON "service_hours" USING btree ("member_id","work_date");