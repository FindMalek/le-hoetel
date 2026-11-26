CREATE TYPE "public"."invoice_status" AS ENUM('issued', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"plan" "hotel_plan" PRIMARY KEY NOT NULL,
	"name" text,
	"monthly_millimes" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer GENERATED ALWAYS AS IDENTITY (sequence name "invoices_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hotel_id" text NOT NULL,
	"hotel_name" text NOT NULL,
	"month" text NOT NULL,
	"plan_name" text NOT NULL,
	"amount_millimes" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'issued' NOT NULL,
	"note" text,
	"paid_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_hotel_month_idx" ON "invoices" USING btree ("hotel_id","month") WHERE "invoices"."status" <> 'void';