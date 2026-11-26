CREATE TYPE "public"."capture_source" AS ENUM('room', 'table', 'desk');--> statement-breakpoint
CREATE TABLE "short_links" (
	"code" text PRIMARY KEY NOT NULL,
	"hotel_id" text NOT NULL,
	"source" "capture_source" NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_links_spot_unique" UNIQUE("hotel_id","source","location")
);
--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;