import { HOTEL_LANGUAGES, HOTEL_PLANS, HOTEL_STATUSES } from "@le-hoetel/common/hotel"
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { organization } from "./orgs"

export const hotelLanguage = pgEnum("hotel_language", HOTEL_LANGUAGES)
export const hotelPlan = pgEnum("hotel_plan", HOTEL_PLANS)
export const hotelStatus = pgEnum("hotel_status", HOTEL_STATUSES)

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
  managerWhatsapp: text("manager_whatsapp"),
  managerTelegram: text("manager_telegram"),
  telegramChatId: text("telegram_chat_id"),
  telegramLinkCode: text("telegram_link_code"),
  telegramLinkExpiresAt: timestamp("telegram_link_expires_at", { withTimezone: true }),
  plan: hotelPlan("plan").notNull().default("starter"),
  status: hotelStatus("status").notNull().default("pilot"),
  pilotEndsAt: timestamp("pilot_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
