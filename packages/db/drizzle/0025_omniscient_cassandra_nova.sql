ALTER TABLE "consent_events" ADD COLUMN "staff_user_id" text;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_staff_user_id_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offer_redemptions_guest_idx" ON "offer_redemptions" USING btree ("guest_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "survey_responses_guest_idx" ON "survey_responses" USING btree ("guest_id","submitted_at");