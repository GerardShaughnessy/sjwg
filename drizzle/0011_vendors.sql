ALTER TABLE "app_users" ADD COLUMN "vendor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "vendor_service" text DEFAULT '' NOT NULL;