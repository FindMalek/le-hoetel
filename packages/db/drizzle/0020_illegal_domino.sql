CREATE TABLE "guest_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"hotel_id" text NOT NULL,
	"source" "guest_source" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_visits" ADD CONSTRAINT "guest_visits_guest_id_hotel_id_guests_id_hotel_id_fk" FOREIGN KEY ("guest_id","hotel_id") REFERENCES "public"."guests"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_visits_guest_idx" ON "guest_visits" USING btree ("guest_id","at");--> statement-breakpoint
CREATE INDEX "guest_visits_hotel_idx" ON "guest_visits" USING btree ("hotel_id","at");