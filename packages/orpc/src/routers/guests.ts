import { type ConsentChannel, MESSAGE_CHANNELS } from "@le-hoetel/common/consent"
import {
  consentEventSchema,
  consentSetSchema,
  GUEST_EXTRA_FIELDS,
  guestCreateSchema,
  guestExportSchema,
  guestListInputSchema,
  guestListSchema,
  guestSchema,
  guestUpdateSchema,
  guestUpsertResultSchema,
  hotelGuestsExportSchema,
} from "@le-hoetel/common/schemas"
import { consentEvents, guestConsents, guests } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, exists, ilike, inArray, not, or, sql } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { clearExtras, hotelGuest, recordConsent, upsertGuest, withConsents } from "../lib/guests"
import { can, hotelProcedure } from "../procedures"

const notFound = () => new ORPCError("NOT_FOUND", { message: "Guest not found." })

async function loadGuest(db: Context["db"], hotelId: string, guestId: string) {
  const [row] = await db.select().from(guests).where(hotelGuest(hotelId, guestId))
  if (!row) throw notFound()
  const [guest] = await withConsents(db, hotelId, [row])
  return guest!
}

async function eventsOf(db: Context["db"], hotelId: string, guestIds: string[] | null) {
  return db
    .select({
      id: consentEvents.id,
      guestId: consentEvents.guestId,
      channel: consentEvents.channel,
      granted: consentEvents.granted,
      source: consentEvents.source,
      wordingVersion: consentEvents.wordingVersion,
      at: consentEvents.at,
    })
    .from(consentEvents)
    .where(and(eq(consentEvents.hotelId, hotelId), guestIds ? inArray(consentEvents.guestId, guestIds) : undefined))
    .orderBy(desc(consentEvents.at))
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
      const granted = (channels: ConsentChannel[]) =>
        exists(
          context.db
            .select({ one: sql`1` })
            .from(guestConsents)
            .where(
              and(
                eq(guestConsents.guestId, guests.id),
                eq(guestConsents.hotelId, hotelId),
                eq(guestConsents.granted, true),
                inArray(guestConsents.channel, channels),
              ),
            ),
        )
      const consent = input.consent
      const where = and(
        eq(guests.hotelId, hotelId),
        input.source ? eq(guests.source, input.source) : undefined,
        input.language ? eq(guests.language, input.language) : undefined,
        consent === "none" ? not(granted(MESSAGE_CHANNELS.slice())) : consent ? granted([consent]) : undefined,
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
    .route({
      method: "POST",
      path: "/guests",
      summary: "Add a guest, or merge into the guest with the same phone",
      tags: ["guests"],
    })
    .input(guestCreateSchema)
    .output(guestUpsertResultSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const { id, merged } = await context.db.transaction((tx) => upsertGuest(tx, hotelId, input, context.now()))
      return { ...(await loadGuest(context.db, hotelId, id)), merged }
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
          await clearExtras(tx, hotelId, input.guestId)
        }
      })
      await audit(context, {
        action: "guest.consent",
        targetId: input.guestId,
        metadata: { hotelId, channel: input.channel, granted: input.granted },
      })
      return loadGuest(context.db, hotelId, input.guestId)
    }),

  export: hotelProcedure
    .use(can({ guest: ["export"] }))
    .route({
      method: "GET",
      path: "/guests/{id}/export",
      summary: "Everything stored about one guest",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(guestExportSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const guest = await loadGuest(context.db, hotelId, input.id)
      await audit(context, { action: "guest.export", targetId: input.id, metadata: { hotelId } })
      return { exportedAt: context.now(), guest, consentEvents: await eventsOf(context.db, hotelId, [input.id]) }
    }),

  exportAll: hotelProcedure
    .use(can({ guest: ["export"] }))
    .route({
      method: "GET",
      path: "/guests/export",
      summary: "Every guest of the hotel with their consent log",
      tags: ["guests"],
    })
    .output(hotelGuestsExportSchema)
    .handler(async ({ context }) => {
      const { hotelId } = context.hotel
      const rows = await context.db.select().from(guests).where(eq(guests.hotelId, hotelId)).orderBy(guests.createdAt)
      const all = await withConsents(context.db, hotelId, rows)
      const events = await eventsOf(context.db, hotelId, null)
      await audit(context, { action: "guest.export-all", metadata: { hotelId, count: all.length } })
      return {
        exportedAt: context.now(),
        guests: all.map((guest) => ({ guest, consentEvents: events.filter((event) => event.guestId === guest.id) })),
      }
    }),

  remove: hotelProcedure
    .use(can({ guest: ["delete"] }))
    .route({
      method: "DELETE",
      path: "/guests/{id}",
      summary: "Delete a guest and everything stored about them",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const removed = await context.db.delete(guests).where(hotelGuest(hotelId, input.id)).returning({ id: guests.id })
      if (!removed.length) throw notFound()
      await audit(context, { action: "guest.delete", targetId: input.id, metadata: { hotelId } })
      return { ok: true as const }
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
      return eventsOf(context.db, hotelId, [input.id])
    }),
}
