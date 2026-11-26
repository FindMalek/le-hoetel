import { INVOICE_STATUSES } from "@ritorno/common/billing"
import { sql } from "drizzle-orm"
import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { hotelPlan } from "./hotels"

export const invoiceStatus = pgEnum("invoice_status", INVOICE_STATUSES)

/** What the app admin calls each plan and charges for it per month, in TND millimes. */
export const billingPlans = pgTable("billing_plans", {
  plan: hotelPlan("plan").primaryKey(),
  name: text("name"),
  monthlyMillimes: integer("monthly_millimes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/**
 * Manual billing records. No foreign key to the hotel on purpose: accounting records outlive a deleted hotel, so the
 * name and plan are copied in. Business data only, never guest data or payment card data.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").generatedAlwaysAsIdentity().notNull().unique(),
    hotelId: text("hotel_id").notNull(),
    hotelName: text("hotel_name").notNull(),
    /** `YYYY-MM` */
    month: text("month").notNull(),
    planName: text("plan_name").notNull(),
    amountMillimes: integer("amount_millimes").notNull(),
    status: invoiceStatus("status").notNull().default("issued"),
    note: text("note"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invoices_hotel_month_idx").on(t.hotelId, t.month).where(sql`${t.status} <> 'void'`)],
)
