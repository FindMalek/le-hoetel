CREATE TYPE "public"."consent_channel" AS ENUM('email', 'whatsapp', 'profile');--> statement-breakpoint
CREATE TYPE "public"."consent_source" AS ENUM('qr_room', 'qr_table', 'qr_front_desk', 'staff', 'csv', 'unsubscribe_link', 'stop_reply', 'guest_request');--> statement-breakpoint
CREATE TYPE "public"."guest_source" AS ENUM('qr_room', 'qr_table', 'qr_front_desk', 'staff', 'csv');--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"hotel_id" text NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"granted" boolean NOT NULL,
	"source" "consent_source" NOT NULL,
	"wording_version" text NOT NULL,
	"ip_hash" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_consents" (
	"guest_id" uuid NOT NULL,
	"hotel_id" text NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"granted" boolean NOT NULL,
	"source" "consent_source" NOT NULL,
	"wording_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_consents_guest_id_channel_pk" PRIMARY KEY("guest_id","channel")
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"language" "hotel_language" NOT NULL,
	"email" text,
	"birthday" date,
	"source" "guest_source" NOT NULL,
	"country" text,
	"city" text,
	"stay_check_in" date,
	"stay_check_out" date,
	"next_destination" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guests_hotel_phone_unique" UNIQUE("hotel_id","phone_e164"),
	CONSTRAINT "guests_id_hotel_unique" UNIQUE("id","hotel_id")
);
--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_guest_id_hotel_id_guests_id_hotel_id_fk" FOREIGN KEY ("guest_id","hotel_id") REFERENCES "public"."guests"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_consents" ADD CONSTRAINT "guest_consents_guest_id_hotel_id_guests_id_hotel_id_fk" FOREIGN KEY ("guest_id","hotel_id") REFERENCES "public"."guests"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_events_guest_idx" ON "consent_events" USING btree ("guest_id","at");--> statement-breakpoint
CREATE INDEX "consent_events_hotel_idx" ON "consent_events" USING btree ("hotel_id","at");--> statement-breakpoint
CREATE INDEX "guest_consents_hotel_channel_idx" ON "guest_consents" USING btree ("hotel_id","channel","granted");--> statement-breakpoint
CREATE INDEX "guests_hotel_created_idx" ON "guests" USING btree ("hotel_id","created_at");