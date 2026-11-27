import { OFFER_TRIGGERS, type OfferTranslations } from "@ritorno/common/offers"
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { guests } from "./guests"
import { organization } from "./orgs"

export const offerTrigger = pgEnum("offer_trigger", OFFER_TRIGGERS)

/** A perk a hotel gives: a title, a text, a validity window and a promo code. Scoped by hotel like everything else. */
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    text: text("text").notNull().default(""),
    /** Title and text per language. `title` and `text` above are what any language without its own gets. */
    translations: jsonb("translations").$type<OfferTranslations>().notNull().default({}),
    promoCode: text("promo_code").notNull(),
    /** Who gets it automatically; null means the staff hands it out. */
    trigger: offerTrigger("trigger"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    maxRedemptions: integer("max_redemptions"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("offers_hotel_promo_unique").on(t.hotelId, t.promoCode),
    unique("offers_id_hotel_unique").on(t.id, t.hotelId),
    index("offers_hotel_active_idx").on(t.hotelId, t.active),
  ],
)

/** The code a guest shows (as a QR) for one offer: one per (offer, guest), unique across hotels so a wrong hotel is told apart from an unknown code. */
export const offerCodes = pgTable(
  "offer_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id").notNull(),
    hotelId: text("hotel_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    code: text("code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("offer_codes_offer_guest_unique").on(t.offerId, t.guestId),
    foreignKey({ columns: [t.offerId, t.hotelId], foreignColumns: [offers.id, offers.hotelId] }).onDelete("cascade"),
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
  ],
)

/**
 * One row per redemption. With a guest it is once per (offer, guest) by the unique constraint, so two staff scanning
 * at the same time cannot both succeed. Without a guest (a promo code said out loud) it is capped by `max_redemptions`.
 * Deleting the guest keeps the row, without the guest.
 */
export const offerRedemptions = pgTable(
  "offer_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id").notNull(),
    hotelId: text("hotel_id").notNull(),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
    redeemedBy: text("redeemed_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("offer_redemptions_offer_guest_unique").on(t.offerId, t.guestId),
    foreignKey({ columns: [t.offerId, t.hotelId], foreignColumns: [offers.id, offers.hotelId] }).onDelete("cascade"),
    index("offer_redemptions_guest_idx").on(t.guestId, t.redeemedAt),
    index("offer_redemptions_hotel_idx").on(t.hotelId, t.redeemedAt),
  ],
)
