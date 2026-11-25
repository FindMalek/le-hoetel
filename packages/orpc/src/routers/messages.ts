import { MESSAGE_CHANNELS } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { MESSAGE_STATUSES } from "@le-hoetel/common/message"
import { guests, messages } from "@le-hoetel/db"
import { and, desc, eq } from "drizzle-orm"
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
})

export const messagesRouter = {
  list: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({ method: "GET", path: "/messages", summary: "The active hotel's latest messages", tags: ["messages"] })
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        status: z.enum(MESSAGE_STATUSES).optional(),
      }),
    )
    .output(z.object({ items: z.array(messageSchema) }))
    .handler(async ({ context, input }) => {
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
        })
        .from(messages)
        .innerJoin(guests, and(eq(guests.id, messages.guestId), eq(guests.hotelId, messages.hotelId)))
        .where(
          and(
            eq(messages.hotelId, context.hotel.hotelId),
            input.status ? eq(messages.status, input.status) : undefined,
          ),
        )
        .orderBy(desc(messages.createdAt), messages.id)
        .limit(input.limit)
      return { items }
    }),
}
