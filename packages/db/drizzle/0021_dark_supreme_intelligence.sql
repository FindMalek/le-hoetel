CREATE TABLE "survey_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"guest_id" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_invites_guest_unique" UNIQUE("guest_id")
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"guest_id" uuid,
	"invite_id" uuid NOT NULL,
	"nps" smallint NOT NULL,
	"rating_rooms" smallint,
	"rating_cleanliness" smallint,
	"rating_service" smallint,
	"comment" text,
	"language" "hotel_language" NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"review_link_clicked_at" timestamp with time zone,
	CONSTRAINT "survey_responses_invite_unique" UNIQUE("invite_id"),
	CONSTRAINT "survey_responses_nps_range" CHECK ("survey_responses"."nps" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "survey_invites" ADD CONSTRAINT "survey_invites_guest_id_hotel_id_guests_id_hotel_id_fk" FOREIGN KEY ("guest_id","hotel_id") REFERENCES "public"."guests"("id","hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_responses_hotel_idx" ON "survey_responses" USING btree ("hotel_id","submitted_at");