ALTER TABLE "hotel_settings" ADD COLUMN "weekly_digest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "hotel_settings" ADD COLUMN "last_digest_week" date;