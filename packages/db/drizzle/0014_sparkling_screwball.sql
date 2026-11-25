CREATE TYPE "public"."holiday_channel" AS ENUM('both', 'email', 'whatsapp');--> statement-breakpoint
CREATE TABLE "hotel_holidays" (
	"hotel_id" text NOT NULL,
	"holiday_key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"channel" "holiday_channel" DEFAULT 'both' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotel_holidays_hotel_id_holiday_key_pk" PRIMARY KEY("hotel_id","holiday_key")
);
--> statement-breakpoint
ALTER TABLE "hotel_holidays" ADD CONSTRAINT "hotel_holidays_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;