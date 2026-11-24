CREATE TYPE "public"."hotel_language" AS ENUM('en', 'fr', 'ar');--> statement-breakpoint
CREATE TYPE "public"."hotel_plan" AS ENUM('starter', 'growth', 'pro');--> statement-breakpoint
CREATE TYPE "public"."hotel_status" AS ENUM('pilot', 'active', 'suspended');--> statement-breakpoint
CREATE TABLE "hotel_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"logo_key" text,
	"primary_color" text,
	"accent_color" text,
	"reply_to_email" text,
	"default_language" "hotel_language" DEFAULT 'fr' NOT NULL,
	"timezone" text DEFAULT 'Africa/Tunis' NOT NULL,
	"google_review_url" text,
	"manager_whatsapp" text,
	"manager_telegram" text,
	"plan" "hotel_plan" DEFAULT 'starter' NOT NULL,
	"status" "hotel_status" DEFAULT 'pilot' NOT NULL,
	"pilot_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hotel_settings" ADD CONSTRAINT "hotel_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;