CREATE TYPE "public"."balance_entry_kind" AS ENUM('top_up', 'usage', 'refund');--> statement-breakpoint
ALTER TYPE "public"."message_status" ADD VALUE 'skipped_no_balance';--> statement-breakpoint
CREATE TABLE "balance_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" text NOT NULL,
	"kind" "balance_entry_kind" NOT NULL,
	"amount_millimes" integer NOT NULL,
	"message_id" uuid,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_balance" (
	"hotel_id" text PRIMARY KEY NOT NULL,
	"balance_millimes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "balance_ledger" ADD CONSTRAINT "balance_ledger_hotel_id_hotel_balance_hotel_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotel_balance"("hotel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_balance" ADD CONSTRAINT "hotel_balance_hotel_id_organization_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_ledger_hotel_created_idx" ON "balance_ledger" USING btree ("hotel_id","created_at");