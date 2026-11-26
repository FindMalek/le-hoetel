import { ORPCError } from "@orpc/server"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { CAPTURE_SOURCES, type CaptureSource } from "@ritorno/common/schemas"
import { whatsappScans } from "@ritorno/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { audit } from "../lib/audit"
import { listScans } from "../lib/whatsapp-scans"
import { can, hotelProcedure } from "../procedures"

const scan = z.object({
  id: z.string(),
  phoneE164: z.string(),
  spot: z.enum(Object.keys(CAPTURE_SOURCES) as [CaptureSource, ...CaptureSource[]]),
  location: z.string().nullable(),
  language: z.enum(HOTEL_LANGUAGES),
  lastScanAt: z.date(),
  guestId: z.string().nullable(),
  guestName: z.string().nullable(),
})

export const whatsappScansRouter = {
  list: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/whatsapp-scans",
      summary: "Guests who wrote on WhatsApp from a QR code in the last 30 days, newest first",
      tags: ["whatsapp"],
    })
    .output(z.array(scan))
    .handler(({ context }) => listScans(context.db, context.hotel.hotelId, context.now())),

  remove: hotelProcedure
    .use(can({ guest: ["update"] }))
    .route({
      method: "DELETE",
      path: "/whatsapp-scans/{id}",
      summary: "Remove one scan and the number stored with it",
      tags: ["whatsapp"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const removed = await context.db
        .delete(whatsappScans)
        .where(and(eq(whatsappScans.id, input.id), eq(whatsappScans.hotelId, hotelId)))
        .returning({ id: whatsappScans.id })
      if (!removed.length) throw new ORPCError("NOT_FOUND", { message: "No such message." })
      await audit(context, { action: "whatsapp-scan.delete", targetId: input.id, metadata: { hotelId } })
      return { ok: true as const }
    }),
}
