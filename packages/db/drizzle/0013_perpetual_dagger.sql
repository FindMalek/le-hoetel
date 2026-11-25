CREATE TABLE "automation_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"guest_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period" text DEFAULT '' NOT NULL,
	"channel" "message_channel" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_sends_once_unique" UNIQUE("guest_id","kind","period","channel")
);
--> statement-breakpoint
ALTER TABLE "automation_sends" ADD CONSTRAINT "automation_sends_guest_id_hotel_id_guests_id_hotel_id_fk" FOREIGN KEY ("guest_id","hotel_id") REFERENCES "public"."guests"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_sends_hotel_kind_idx" ON "automation_sends" USING btree ("hotel_id","kind","period");