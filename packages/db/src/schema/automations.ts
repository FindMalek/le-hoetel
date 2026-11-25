import { foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { guests } from "./guests"
import { messageChannel } from "./messages"

/**
 * One row per automatic message a guest was sent, written just before it goes out. The unique key is what makes
 * the jobs idempotent: a retry, a second enqueue or a second worker finds the row and sends nothing.
 * `kind` is the automation (`welcome`, `birthday`, `holiday:<key>`), `period` repeats it (`""` once, `2026` yearly).
 */
export const automationSends = pgTable(
  "automation_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    kind: text("kind").notNull(),
    period: text("period").notNull().default(""),
    channel: messageChannel("channel").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
    unique("automation_sends_once_unique").on(t.guestId, t.kind, t.period, t.channel),
    index("automation_sends_hotel_kind_idx").on(t.hotelId, t.kind, t.period),
  ],
)
