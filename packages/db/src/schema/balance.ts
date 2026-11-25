import { foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organization } from "./orgs"

export const BALANCE_ENTRY_KINDS = ["top_up", "usage", "refund"] as const
export const balanceEntryKind = pgEnum("balance_entry_kind", BALANCE_ENTRY_KINDS)

/** Prepaid WhatsApp credit of a hotel, in TND millimes. Always equals the sum of its ledger. */
export const hotelBalance = pgTable("hotel_balance", {
  hotelId: text("hotel_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  balanceMillimes: integer("balance_millimes").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/** Append-only: top-ups and refunds are positive, usage is negative. `messageId` points at the message row of a usage. */
export const balanceLedger = pgTable(
  "balance_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id").notNull(),
    kind: balanceEntryKind("kind").notNull(),
    amountMillimes: integer("amount_millimes").notNull(),
    messageId: uuid("message_id"),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.hotelId], foreignColumns: [hotelBalance.hotelId] }).onDelete("cascade"),
    index("balance_ledger_hotel_created_idx").on(t.hotelId, t.createdAt),
  ],
)
