import { HOTEL_LANGUAGES, HOTEL_PLANS, HOTEL_STATUSES } from "@ritorno/common/hotel"
import { SPOT_SOURCES } from "@ritorno/common/schemas"
import { boolean, date, pgEnum, pgTable, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core"
import { organization } from "./orgs"

export const hotelLanguage = pgEnum("hotel_language", HOTEL_LANGUAGES)
export const hotelPlan = pgEnum("hotel_plan", HOTEL_PLANS)
export const hotelStatus = pgEnum("hotel_status", HOTEL_STATUSES)
export const spotSource = pgEnum("spot_source", SPOT_SOURCES)

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
