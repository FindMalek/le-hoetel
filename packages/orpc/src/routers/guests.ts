import {
  consentEventSchema,
  consentSetSchema,
  GUEST_EXTRA_FIELDS,
  guestCreateSchema,
  guestListInputSchema,
  guestListSchema,
  guestSchema,
  guestUpdateSchema,
} from "@le-hoetel/common/schemas"
import { consentEvents, guests } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { hotelGuest, recordConsent, withConsents } from "../lib/guests"
import { can, hotelProcedure } from "../procedures"

const notFound = () => new ORPCError("NOT_FOUND", { message: "Guest not found." })

async function loadGuest(db: Context["db"], hotelId: string, guestId: string) {
  const [row] = await db.select().from(guests).where(hotelGuest(hotelId, guestId))
  if (!row) throw notFound()
  const [guest] = await withConsents(db, hotelId, [row])
  return guest!
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

export const guestsRouter = {
  list: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({ method: "GET", path: "/guests", summary: "The active hotel's guests", tags: ["guests"] })
    .input(guestListInputSchema)
    .output(guestListSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const q = input.q ? `%${escapeLike(input.q)}%` : null
      const where = and(
        eq(guests.hotelId, hotelId),
        q ? or(ilike(guests.name, q), ilike(guests.phoneE164, q), ilike(guests.email, q)) : undefined,
      )
      const [totals] = await context.db.select({ n: count() }).from(guests).where(where)
      const rows = await context.db
        .select()
        .from(guests)
        .where(where)
        .orderBy(desc(guests.createdAt), guests.id)
        .limit(input.limit)
        .offset(input.offset)
      return { items: await withConsents(context.db, hotelId, rows), total: totals?.n ?? 0 }
    }),

  get: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({ method: "GET", path: "/guests/{id}", summary: "One guest", tags: ["guests"] })
    .input(z.object({ id: z.uuid() }))
    .output(guestSchema)
    .handler(({ context, input }) => loadGuest(context.db, context.hotel.hotelId, input.id)),

  create: hotelProcedure
    .use(can({ guest: ["create"] }))
    .route({ method: "POST", path: "/guests", summary: "Add a guest with their consent answers", tags: ["guests"] })
    .input(guestCreateSchema)
    .output(guestSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const { consents, phone, ...fields } = input
      const at = context.now()
      const id = await context.db.transaction(async (tx) => {
        const [taken] = await tx
          .select({ id: guests.id })
          .from(guests)
          .where(and(eq(guests.hotelId, hotelId), eq(guests.phoneE164, phone)))
        if (taken) throw new ORPCError("CONFLICT", { message: "A guest with this phone already exists." })
        const [row] = await tx
          .insert(guests)
          .values({ ...fields, phoneE164: phone, hotelId })
          .returning({ id: guests.id })
        for (const [channel, granted] of Object.entries(consents)) {
          await recordConsent(tx, {
            hotelId,
            guestId: row!.id,
            channel: channel as keyof typeof consents,
            granted,
            source: fields.source,
            at,
          })
        }
        return row!.id
      })
      return loadGuest(context.db, hotelId, id)
    }),

  update: hotelProcedure
    .use(can({ guest: ["update"] }))
    .route({ method: "PATCH", path: "/guests/{id}", summary: "Update a guest's details", tags: ["guests"] })
    .input(guestUpdateSchema)
    .output(guestSchema)
    .handler(async ({ context, input: { id, ...patch } }) => {
      const { hotelId } = context.hotel
      const current = await loadGuest(context.db, hotelId, id)
      if (!current.consents.profile && GUEST_EXTRA_FIELDS.some((field) => patch[field] != null)) {
        throw new ORPCError("BAD_REQUEST", { message: "Country, city and stay details need the guest's consent." })
      }
      if (patch.email === null && current.consents.email) {
        throw new ORPCError("BAD_REQUEST", { message: "Withdraw the email consent before removing the email." })
      }
      if (Object.keys(patch).length) {
        await context.db.update(guests).set(patch).where(hotelGuest(hotelId, id))
      }
      return loadGuest(context.db, hotelId, id)
    }),

  setConsent: hotelProcedure
    .use(can({ guest: ["update"] }))
    .route({
      method: "POST",
      path: "/guests/{guestId}/consent",
      summary: "Grant or withdraw one consent, always logged",
      tags: ["guests"],
    })
    .input(consentSetSchema)
    .output(guestSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const current = await loadGuest(context.db, hotelId, input.guestId)
      if (input.channel === "email" && input.granted && !current.email) {
        throw new ORPCError("BAD_REQUEST", { message: "Add an email address first." })
      }
      await context.db.transaction(async (tx) => {
        await recordConsent(tx, { hotelId, ...input, at: context.now() })
        if (input.channel === "profile" && !input.granted) {
          await tx
            .update(guests)
            .set({ country: null, city: null, stayCheckIn: null, stayCheckOut: null, nextDestination: null })
            .where(hotelGuest(hotelId, input.guestId))
        }
      })
      await audit(context, {
        action: "guest.consent",
        targetId: input.guestId,
        metadata: { hotelId, channel: input.channel, granted: input.granted },
      })
      return loadGuest(context.db, hotelId, input.guestId)
    }),

  consentHistory: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/guests/{id}/consent-events",
      summary: "The consent log of one guest, newest first",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.array(consentEventSchema))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      await loadGuest(context.db, hotelId, input.id)
      return context.db
        .select({
          id: consentEvents.id,
          channel: consentEvents.channel,
          granted: consentEvents.granted,
          source: consentEvents.source,
          wordingVersion: consentEvents.wordingVersion,
          at: consentEvents.at,
        })
        .from(consentEvents)
        .where(and(eq(consentEvents.hotelId, hotelId), eq(consentEvents.guestId, input.id)))
        .orderBy(desc(consentEvents.at))
    }),
}
