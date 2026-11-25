import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { hotelLanguage } from "./hotels"

/** A hotel that asked for a demo on the landing page. Not tied to any hotel account: it is how a hotel becomes one. */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    hotelName: text("hotel_name").notNull(),
    phone: text("phone").notNull(),
    city: text("city").notNull(),
    language: hotelLanguage("language").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_created_idx").on(t.createdAt)],
)
