import { CONSENT_CHANNELS, CONSENT_SOURCES, GUEST_SOURCES } from "@le-hoetel/common/consent"
import {
  boolean,
  date,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { hotelLanguage } from "./hotels"
import { organization } from "./orgs"

export const guestSource = pgEnum("guest_source", GUEST_SOURCES)
export const consentChannel = pgEnum("consent_channel", CONSENT_CHANNELS)
export const consentSource = pgEnum("consent_source", CONSENT_SOURCES)

/**
 * A hotel's guest. Not an auth user. Must have: name, phone, language. Optional: email, birthday. Optional with
 * the `profile` consent: country, city, stay dates, next destination (cleared when that consent is withdrawn).
 * Never stored: location, passport or ID numbers, payment cards.
 */
export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    language: hotelLanguage("language").notNull(),
    email: text("email"),
    birthday: date("birthday", { mode: "string" }),
    source: guestSource("source").notNull(),
    /** The spot of the QR code that captured the guest (a room number, a table), as printed on the code. */
    captureLocation: text("capture_location"),
    country: text("country"),
    city: text("city"),
    stayCheckIn: date("stay_check_in", { mode: "string" }),
    stayCheckOut: date("stay_check_out", { mode: "string" }),
    nextDestination: text("next_destination"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("guests_hotel_phone_unique").on(t.hotelId, t.phoneE164),
    // Lets child tables point at (guest, hotel) together, so a row can never reference another hotel's guest.
    unique("guests_id_hotel_unique").on(t.id, t.hotelId),
    index("guests_hotel_created_idx").on(t.hotelId, t.createdAt),
  ],
)

/** The current answer per guest and channel. Always changed together with an event in `consent_events`. */
export const guestConsents = pgTable(
  "guest_consents",
  {
    guestId: uuid("guest_id").notNull(),
    hotelId: text("hotel_id").notNull(),
    channel: consentChannel("channel").notNull(),
    granted: boolean("granted").notNull(),
    source: consentSource("source").notNull(),
    wordingVersion: text("wording_version").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.guestId, t.channel] }),
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
    index("guest_consents_hotel_channel_idx").on(t.hotelId, t.channel, t.granted),
  ],
)

/**
 * Append only: the api never updates a row. A change of mind is a new row. Removed only with the guest
 * (hard delete), so no personal data outlives a deletion.
 */
export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guestId: uuid("guest_id").notNull(),
    hotelId: text("hotel_id").notNull(),
    channel: consentChannel("channel").notNull(),
    granted: boolean("granted").notNull(),
    source: consentSource("source").notNull(),
    wordingVersion: text("wording_version").notNull(),
    /** Salted hash of the capture ip, never the ip itself. Optional. */
    ipHash: text("ip_hash"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
    index("consent_events_guest_idx").on(t.guestId, t.at),
    index("consent_events_hotel_idx").on(t.hotelId, t.at),
  ],
)
