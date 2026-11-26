import { ORPCError } from "@orpc/server"
import { MESSAGE_CHANNELS } from "@ritorno/common/consent"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { MESSAGE_STATUSES } from "@ritorno/common/message"
import { guests, messages } from "@ritorno/db"
import { HOTEL_EMAIL_KEYS } from "@ritorno/notification"
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm"
import { z } from "zod"
import { can, hotelProcedure } from "../procedures"

const messageSchema = z.object({
  id: z.uuid(),
  guestId: z.uuid(),
  guestName: z.string(),
  channel: z.enum(MESSAGE_CHANNELS),
  templateKey: z.string(),
  language: z.enum(HOTEL_LANGUAGES),
  status: z.enum(MESSAGE_STATUSES),
  errorCode: z.string().nullable(),
  createdAt: z.date(),
  /** Rendered but never handed to a provider (log-only): `preview` has the text. */
  notSent: z.boolean(),
})

const previewSchema = z.union([z.object({ subject: z.string(), html: z.string() }), z.object({ text: z.string() })])

export const messagesRouter = {
  list: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({ method: "GET", path: "/messages", summary: "The active hotel's latest messages", tags: ["messages"] })
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        status: z.enum(MESSAGE_STATUSES).optional(),
        channel: z.enum(MESSAGE_CHANNELS).optional(),
        template: z.enum(HOTEL_EMAIL_KEYS).optional(),
        /** Only messages from the last this many days. */
        days: z.number().int().min(1).max(366).optional(),
      }),
    )
    .output(z.object({ items: z.array(messageSchema), total: z.number() }))
    .handler(async ({ context, input }) => {
      const where = and(
        eq(messages.hotelId, context.hotel.hotelId),
        input.status ? eq(messages.status, input.status) : undefined,
        input.channel ? eq(messages.channel, input.channel) : undefined,
        input.template ? eq(messages.templateKey, input.template) : undefined,
        input.days ? gte(messages.createdAt, new Date(context.now().getTime() - input.days * 86_400_000)) : undefined,
      )
      const [totals] = await context.db.select({ n: count() }).from(messages).where(where)
      const items = await context.db
        .select({
          id: messages.id,
          guestId: messages.guestId,
          guestName: guests.name,
          channel: messages.channel,
          templateKey: messages.templateKey,
          language: messages.language,
          status: messages.status,
          errorCode: messages.errorCode,
          createdAt: messages.createdAt,
          notSent: sql<boolean>`${isNotNull(messages.preview)}`,
        })
        .from(messages)
        .innerJoin(guests, and(eq(guests.id, messages.guestId), eq(guests.hotelId, messages.hotelId)))
        .where(where)
        .orderBy(desc(messages.createdAt), messages.id)
        .limit(input.limit)
        .offset(input.offset)
      return { items, total: totals?.n ?? 0 }
    }),

  preview: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/messages/{id}/preview",
      summary: "The text of a message that was not really sent",
      tags: ["messages"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(previewSchema)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .select({ preview: messages.preview })
        .from(messages)
        .where(and(eq(messages.hotelId, context.hotel.hotelId), eq(messages.id, input.id)))
      if (!row?.preview) throw new ORPCError("NOT_FOUND", { message: "No preview for this message." })
      return row.preview
    }),
}
