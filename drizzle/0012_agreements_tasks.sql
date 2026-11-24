CREATE TABLE "task_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_time" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid,
	"minutes" integer NOT NULL,
	"worked_on" date DEFAULT current_date NOT NULL,
	"note" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_time_minutes_positive" CHECK ("task_time"."minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "duties" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sign_requests" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time" ADD CONSTRAINT "task_time_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_time" ADD CONSTRAINT "task_time_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_notifications_pending_once" ON "task_notifications" USING btree ("user_id","task_id") WHERE "task_notifications"."sent_at" is null;--> statement-breakpoint
CREATE INDEX "task_notifications_unsent_idx" ON "task_notifications" USING btree ("created_at") WHERE "task_notifications"."sent_at" is null;--> statement-breakpoint
CREATE INDEX "task_time_task_idx" ON "task_time" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_time_user_idx" ON "task_time" USING btree ("user_id","worked_on");--> statement-breakpoint
ALTER TABLE "sign_requests" ADD CONSTRAINT "sign_requests_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sign_requests_user_idx" ON "sign_requests" USING btree ("user_id");