import { MESSAGE_CHANNELS } from "@ritorno/common/consent"
import { MESSAGE_STATUSES, type MessagePreview } from "@ritorno/common/message"
import { foreignKey, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { guests } from "./guests"
import { hotelLanguage } from "./hotels"

export const messageChannel = pgEnum("message_channel", MESSAGE_CHANNELS)
export const messageStatus = pgEnum("message_status", MESSAGE_STATUSES)

/**
 * One row per message to a guest, written by the dispatcher. Never holds the recipient: which template, in which
 * language, and how it ended. The rendered text is kept only for a message that was not really sent (log-only
 * providers), in `preview`. Removed with the guest.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id").notNull(),
    guestId: uuid("guest_id").notNull(),
    channel: messageChannel("channel").notNull(),
    templateKey: text("template_key").notNull(),
    language: hotelLanguage("language").notNull(),
    status: messageStatus("status").notNull(),
    providerId: text("provider_id"),
    errorCode: text("error_code"),
    preview: jsonb("preview").$type<MessagePreview>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.guestId, t.hotelId], foreignColumns: [guests.id, guests.hotelId] }).onDelete("cascade"),
    index("messages_hotel_created_idx").on(t.hotelId, t.createdAt),
    index("messages_guest_idx").on(t.guestId, t.createdAt),
    index("messages_provider_idx").on(t.providerId),
  ],
)
