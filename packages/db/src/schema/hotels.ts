import { HOTEL_LANGUAGES, HOTEL_PLANS, HOTEL_STATUSES } from "@ritorno/common/hotel"
import { CAPTURE_SOURCES, type CaptureSource, SPOT_SOURCES } from "@ritorno/common/schemas"
import { boolean, date, pgEnum, pgTable, primaryKey, smallint, text, timestamp, unique } from "drizzle-orm/pg-core"
import { organization } from "./orgs"

export const hotelLanguage = pgEnum("hotel_language", HOTEL_LANGUAGES)
export const hotelPlan = pgEnum("hotel_plan", HOTEL_PLANS)
export const hotelStatus = pgEnum("hotel_status", HOTEL_STATUSES)
export const spotSource = pgEnum("spot_source", SPOT_SOURCES)
export const captureSource = pgEnum(
  "capture_source",
  Object.keys(CAPTURE_SOURCES) as [CaptureSource, ...CaptureSource[]],
)

/** One row per hotel (organization): branding and operating config, never code per hotel. */
export const hotelSettings = pgTable("hotel_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  logoKey: text("logo_key"),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  replyToEmail: text("reply_to_email"),
  defaultLanguage: hotelLanguage("default_language").notNull().default("fr"),
  timezone: text("timezone").notNull().default("Africa/Tunis"),
  address: text("address"),
  googleReviewUrl: text("google_review_url"),
  /** A survey score at or below this opens a feedback case and alerts the manager. */
  lowScoreThreshold: smallint("low_score_threshold").notNull().default(6),
  managerWhatsapp: text("manager_whatsapp"),
  weeklyDigest: boolean("weekly_digest").notNull().default(true),
  /** The Monday (hotel time) the owner digest last went out, claimed before sending. */
  lastDigestWeek: date("last_digest_week", { mode: "string" }),
  plan: hotelPlan("plan").notNull().default("starter"),
  status: hotelStatus("status").notNull().default("pilot"),
  pilotEndsAt: timestamp("pilot_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/** The rooms and tables a hotel prints codes for. The code itself only needs the url, so removing one breaks nothing. */
export const captureSpots = pgTable(
  "capture_spots",
  {
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    source: spotSource("source").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.hotelId, t.source, t.name] })],
)

/**
 * What a printed `/q/<code>` points at. The hotel is kept by id, so a new slug breaks no printed code. Rows are never
 * deleted on their own (removing a saved spot included): paper outlives the list.
 */
export const shortLinks = pgTable(
  "short_links",
  {
    code: text("code").primaryKey(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    source: captureSource("source").notNull(),
    /** Empty for a code without a spot: a null would let the same code be made twice. */
    location: text("location").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("short_links_spot_unique").on(t.hotelId, t.source, t.location)],
)
