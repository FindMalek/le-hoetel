import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUSES,
  type CampaignContent,
  type CampaignSegment,
} from "@ritorno/common/campaigns"
import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { guests } from "./guests"
import { messageChannel, messages } from "./messages"
import { offers } from "./offers"
import { organization } from "./orgs"

export const campaignChannel = pgEnum("campaign_channel", CAMPAIGN_CHANNELS)
export const campaignStatus = pgEnum("campaign_status", CAMPAIGN_STATUSES)

/** A one-off message to a segment of a hotel's guests. Drafts are free to edit, the rest only move forward or get cancelled. */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: campaignChannel("channel").notNull(),
    content: jsonb("content").$type<CampaignContent>().notNull(),
    segment: jsonb("segment").$type<CampaignSegment>().notNull(),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    status: campaignStatus("status").notNull().default("draft"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("campaigns_hotel_created_idx").on(t.hotelId, t.createdAt),
    index("campaigns_due_idx").on(t.status, t.scheduledAt),
  ],
)

/**
 * One row per guest and channel a campaign went to, written just before the send: it is the claim that keeps a
 * guest from getting the same campaign twice, and it points to the message log row for the result.
 */
export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    hotelId: text("hotel_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    channel: messageChannel("channel").notNull(),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
    unique("campaign_recipients_once_unique").on(t.campaignId, t.guestId, t.channel),
  ],
)
