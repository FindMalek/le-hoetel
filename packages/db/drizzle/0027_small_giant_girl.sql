CREATE TYPE "public"."spot_source" AS ENUM('room', 'table');--> statement-breakpoint
CREATE TABLE "capture_spots" (
	"hotel_id" text NOT NULL,
	"source" "spot_source" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_spots_hotel_id_source_name_pk" PRIMARY KEY("hotel_id","source","name")
);
--> statement-breakpoint
ALTER TABLE "capture_spots" ADD CONSTRAINT "capture_spots_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;