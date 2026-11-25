import { sql } from "drizzle-orm"
import { check, foreignKey, index, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { guests } from "./guests"
import { hotelLanguage } from "./hotels"
import { organization } from "./orgs"

/** One post-stay survey link per guest. Deleted with the guest; `expiresAt` is 14 days after it was created. */
export const surveyInvites = pgTable(
  "survey_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
    unique("survey_invites_guest_unique").on(t.guestId),
  ],
)

/**
 * What a guest answered. The guest link is dropped when the guest is deleted, the answers stay as anonymous
 * feedback of the hotel. At most one response per invite.
 */
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
    inviteId: uuid("invite_id").notNull(),
    nps: smallint("nps").notNull(),
    ratingRooms: smallint("rating_rooms"),
    ratingCleanliness: smallint("rating_cleanliness"),
    ratingService: smallint("rating_service"),
    comment: text("comment"),
    language: hotelLanguage("language").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewLinkClickedAt: timestamp("review_link_clicked_at", { withTimezone: true }),
  },
  (t) => [
    unique("survey_responses_invite_unique").on(t.inviteId),
    index("survey_responses_hotel_idx").on(t.hotelId, t.submittedAt),
    check("survey_responses_nps_range", sql`${t.nps} between 0 and 10`),
  ],
)
