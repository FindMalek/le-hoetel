CREATE TYPE "public"."feedback_case_status" AS ENUM('new', 'contacted', 'resolved');--> statement-breakpoint
CREATE TABLE "feedback_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"response_id" uuid NOT NULL,
	"status" "feedback_case_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"handled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_cases_response_unique" UNIQUE("response_id")
);
--> statement-breakpoint
ALTER TABLE "hotel_settings" ADD COLUMN "low_score_threshold" smallint DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_cases_hotel_idx" ON "feedback_cases" USING btree ("hotel_id","status");