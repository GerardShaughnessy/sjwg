ALTER TABLE "app_users" ADD COLUMN "director" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "board_title" text DEFAULT '' NOT NULL;