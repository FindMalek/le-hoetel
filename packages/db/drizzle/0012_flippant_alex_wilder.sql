CREATE TYPE "public"."offer_trigger" AS ENUM('welcome', 'birthday', 'manual');--> statement-breakpoint
CREATE TABLE "offer_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"hotel_id" text NOT NULL,
	"guest_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "offer_codes_offer_guest_unique" UNIQUE("offer_id","guest_id")
);
--> statement-breakpoint
CREATE TABLE "offer_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"hotel_id" text NOT NULL,
	"guest_id" uuid,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redeemed_by" text,
	CONSTRAINT "offer_redemptions_offer_guest_unique" UNIQUE("offer_id","guest_id")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"title" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"promo_code" text NOT NULL,
	"trigger" "offer_trigger",
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"max_redemptions" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_hotel_promo_unique" UNIQUE("hotel_id","promo_code"),
	CONSTRAINT "offers_id_hotel_unique" UNIQUE("id","hotel_id")
);
--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_offer_id_hotel_id_offers_id_hotel_id_fk" FOREIGN KEY ("offer_id","hotel_id") REFERENCES "public"."offers"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_codes" ADD CONSTRAINT "offer_codes_guest_id_hotel_id_guests_id_hotel_id_fk" FOREIGN KEY ("guest_id","hotel_id") REFERENCES "public"."guests"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_redeemed_by_user_id_fk" FOREIGN KEY ("redeemed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_redemptions" ADD CONSTRAINT "offer_redemptions_offer_id_hotel_id_offers_id_hotel_id_fk" FOREIGN KEY ("offer_id","hotel_id") REFERENCES "public"."offers"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_redemptions_hotel_idx" ON "offer_redemptions" USING btree ("hotel_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "offers_hotel_active_idx" ON "offers" USING btree ("hotel_id","active");