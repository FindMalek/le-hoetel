import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { guestSource } from "./guests"
import { hotelLanguage } from "./hotels"
import { organization } from "./orgs"

/**
 * A guest who messaged the shared business number from a QR code, for staff to answer. Not a consent and not a guest:
 * one row per hotel and number, no name and no message text, dropped after 30 days, on STOP and with the guest.
 */
export const whatsappScans = pgTable(
  "whatsapp_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    source: guestSource("source").notNull(),
    location: text("location"),
    language: hotelLanguage("language").notNull(),
    lastScanAt: timestamp("last_scan_at", { withTimezone: true }).notNull(),
    /** When the automatic welcome was last claimed: at most one per 24 hours. */
    repliedAt: timestamp("replied_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("whatsapp_scans_hotel_phone_unique").on(t.hotelId, t.phoneE164),
    index("whatsapp_scans_hotel_last_idx").on(t.hotelId, t.lastScanAt),
    index("whatsapp_scans_phone_idx").on(t.phoneE164),
  ],
)
