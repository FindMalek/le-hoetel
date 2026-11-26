CREATE TABLE "whatsapp_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"phone_e164" text NOT NULL,
	"source" "guest_source" NOT NULL,
	"location" text,
	"language" "hotel_language" NOT NULL,
	"last_scan_at" timestamp with time zone NOT NULL,
	"replied_at" timestamp with time zone NOT NULL,
	CONSTRAINT "whatsapp_scans_hotel_phone_unique" UNIQUE("hotel_id","phone_e164")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_scans" ADD CONSTRAINT "whatsapp_scans_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_scans_hotel_last_idx" ON "whatsapp_scans" USING btree ("hotel_id","last_scan_at");--> statement-breakpoint
CREATE INDEX "whatsapp_scans_phone_idx" ON "whatsapp_scans" USING btree ("phone_e164");