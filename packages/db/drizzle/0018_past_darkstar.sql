ALTER TABLE "hotel_settings" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "hotel_settings" ADD COLUMN "telegram_link_code" text;--> statement-breakpoint
ALTER TABLE "hotel_settings" ADD COLUMN "telegram_link_expires_at" timestamp with time zone;