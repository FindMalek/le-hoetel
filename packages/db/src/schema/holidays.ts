import { HOLIDAY_CHANNELS } from "@le-hoetel/common/holidays"
import { boolean, pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import { organization } from "./orgs"

export const holidayChannel = pgEnum("holiday_channel", HOLIDAY_CHANNELS)

/** What a hotel chose per holiday. No row means off: a hotel opts in, nothing is sent by default. */
export const hotelHolidays = pgTable(
  "hotel_holidays",
  {
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    holidayKey: text("holiday_key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    channel: holidayChannel("channel").notNull().default("both"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.hotelId, t.holidayKey] })],
)
