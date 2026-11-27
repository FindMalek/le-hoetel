import { ORPCError } from "@orpc/server"
import { type ConsentChannel, MESSAGE_CHANNELS } from "@ritorno/common/consent"
import { phoneSearchDigits } from "@ritorno/common/dial"
import { guestsToCsv } from "@ritorno/common/guest-export"
import { UNDO_WINDOW_MS } from "@ritorno/common/hotel-time"
import { MESSAGE_STATUSES } from "@ritorno/common/message"
import {
  consentEventSchema,
  consentSetSchema,
  GUEST_EXTRA_FIELDS,
  guestActivitySchema,
  guestCreateSchema,
  guestExportSchema,
  guestFromImportRow,
  guestImportInputSchema,
  guestImportResultSchema,
  guestListInputSchema,
  guestListSchema,
  guestRecognitionSchema,
  guestSchema,
  guestUpdateSchema,
  guestUpsertResultSchema,
  guestVisitResultSchema,
  hotelGuestsExportSchema,
  isStayOrdered,
  STAY_ORDER_MESSAGE,
} from "@ritorno/common/schemas"
import {
  consentEvents,
  guestConsents,
  guests,
  guestVisits,
  messages,
  offerRedemptions,
  offers,
  surveyResponses,
} from "@ritorno/db"
import { and, count, desc, eq, exists, gt, ilike, inArray, ne, not, or, sql } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { enqueueWelcome } from "../jobs"
import { audit } from "../lib/audit"
import { afterCursor, cursorAt, cursorPage } from "../lib/cursor"
import { eraseFeedbackNotes, feedbackOfGuests } from "../lib/feedback-cases"
import {
  clearExtras,
  hashGuestId,
  hotelGuest,
  recognitionOf,
  recordConsent,
  recordVisit,
  upsertGuest,
  withConsents,
} from "../lib/guests"
import { isUniqueViolation } from "../lib/offers"
import { eraseGuestScans, scansForExport } from "../lib/whatsapp-scans"
import { can, hotelExportProcedure, hotelProcedure } from "../procedures"

const guestMessageSchema = z.object({
  id: z.uuid(),
  channel: z.enum(MESSAGE_CHANNELS),
  templateKey: z.string(),
  status: z.enum(MESSAGE_STATUSES),
  createdAt: z.date(),
})

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

const phoneTaken = (guestId?: string) =>
  new ORPCError("CONFLICT", { message: "Another guest already has this phone number.", data: { guestId } })

/**
 * WhatsApp consent was given for the old number, so a new number turns it off, logged, until the guest agrees again.
 * The old number's QR scans go too: after the change, deleting the guest would no longer reach them.
 */
async function updateWithNewPhone(
  context: Pick<Context, "db" | "now">,
  change: { hotelId: string; staffUserId: string; guestId: string },
  patch: Partial<typeof guests.$inferInsert> & { phoneE164: string },
): Promise<{ whatsappWithdrawn: boolean }> {
  const { hotelId, staffUserId, guestId } = change
  const holder = () =>
    context.db
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.hotelId, hotelId), eq(guests.phoneE164, patch.phoneE164), ne(guests.id, guestId)))
  const [other] = await holder()
  if (other) throw phoneTaken(other.id)
  try {
    return await context.db.transaction(async (tx) => {
      // Locked, then read again: the consent may have changed since the request started.
      const [locked] = await tx.select().from(guests).where(hotelGuest(hotelId, guestId)).for("update")
      if (!locked) throw notFound()
      const [fresh] = await withConsents(tx, hotelId, [locked])
      const whatsappWithdrawn =
        fresh!.consents.whatsapp &&
        (await recordConsent(tx, {
          hotelId,
          guestId,
          channel: "whatsapp",
          granted: false,
          source: "staff",
          at: context.now(),
          staffUserId,
        }))
      await eraseGuestScans(tx, hotelId, guestId)
      // The database clock, the same one that stamps `messages.created_at`.
      await tx
        .update(guests)
        .set({ ...patch, phoneChangedAt: sql`now()` })
        .where(hotelGuest(hotelId, guestId))
      return { whatsappWithdrawn }
    })
  } catch (error) {
    // Someone took the number between the check and the write.
    if (isUniqueViolation(error)) throw phoneTaken((await holder())[0]?.id)
    throw error
  }
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
      const digits = phoneSearchDigits(input.q ?? "")
      const visits = sql<number>`(select count(*)::int from guest_visits v where v.guest_id = "guests"."id" and v.hotel_id = ${hotelId})`
      const where = and(
        eq(guests.hotelId, hotelId),
        input.source ? eq(guests.source, input.source) : undefined,
        input.language ? eq(guests.language, input.language) : undefined,
        consent === "none" ? not(granted(MESSAGE_CHANNELS.slice())) : consent ? granted([consent]) : undefined,
        input.returning ? sql`${visits} >= 2` : undefined,
        q
          ? or(
              ilike(guests.name, q),
              ilike(guests.email, q),
              digits.length >= 3 ? ilike(guests.phoneE164, `%${digits}%`) : undefined,
            )
          : undefined,
      )
      const [totals] = await context.db.select({ n: count() }).from(guests).where(where)
      const rows = await context.db
        .select({ id: guests.id, cursorAt: cursorAt(guests.createdAt), guest: guests, visits })
        .from(guests)
        .where(and(where, afterCursor(guests.createdAt, guests.id, input.cursor)))
        .orderBy(desc(guests.createdAt), guests.id)
        .limit(input.limit + 1)
      const page = cursorPage(rows, input.limit)
      const items = await withConsents(
        context.db,
        hotelId,
        page.items.map((row) => row.guest),
      )
      return {
        items: items.map((item, index) => ({ ...item, visits: page.items[index]?.visits ?? 0 })),
        total: totals?.n ?? 0,
        nextCursor: page.nextCursor,
      }
    }),

  find: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/guests/find",
      summary: "Find guests by phone or name, with visit history",
      tags: ["guests"],
    })
    .input(z.object({ q: z.string().trim().min(2).max(80) }))
    .output(z.array(guestRecognitionSchema))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const q = `%${escapeLike(input.q)}%`
      const digits = phoneSearchDigits(input.q)
      const rows = await context.db
        .select()
        .from(guests)
        .where(
          and(
            eq(guests.hotelId, hotelId),
            or(ilike(guests.name, q), digits.length >= 3 ? ilike(guests.phoneE164, `%${digits}%`) : undefined),
          ),
        )
        .orderBy(desc(guests.updatedAt), guests.id)
        .limit(5)
      return recognitionOf(context.db, hotelId, rows, context.now())
    }),

  markVisit: hotelProcedure
    .use(can({ guest: ["create"] }))
    .route({
      method: "POST",
      path: "/guests/{id}/visits",
      summary: "Record that the guest is here again, once per hotel day",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(guestVisitResultSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const [row] = await context.db.select().from(guests).where(hotelGuest(hotelId, input.id))
      if (!row) throw notFound()
      const at = context.now()
      const visitId = await recordVisit(context.db, { hotelId, guestId: row.id, source: "staff", at })
      const [card] = await recognitionOf(context.db, hotelId, [row], at)
      return { ...card!, visitId }
    }),

  undoVisit: hotelProcedure
    .use(can({ guest: ["create"] }))
    .route({
      method: "DELETE",
      path: "/guests/{id}/visits/{visitId}",
      summary: "Take back a visit staff just marked by mistake",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid(), visitId: z.uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const deleted = await context.db
        .delete(guestVisits)
        .where(
          and(
            eq(guestVisits.id, input.visitId),
            eq(guestVisits.guestId, input.id),
            eq(guestVisits.hotelId, context.hotel.hotelId),
            eq(guestVisits.source, "staff"),
            gt(guestVisits.at, new Date(context.now().getTime() - UNDO_WINDOW_MS)),
          ),
        )
        .returning({ id: guestVisits.id })
      if (!deleted.length) throw notFound()
      return { ok: true as const }
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
      const {
        id,
        consentKept: _,
        ...outcome
      } = await context.db.transaction((tx) => upsertGuest(tx, hotelId, input, context.now(), context.user.id))
      await enqueueWelcome(context, hotelId, id, input.consents)
      return { ...(await loadGuest(context.db, hotelId, id)), ...outcome }
    }),

  import: hotelProcedure
    .use(can({ guest: ["import"] }))
    .route({
      method: "POST",
      path: "/guests/import",
      summary: "Import guests from csv rows, one result per row, merged by phone",
      tags: ["guests"],
    })
    .input(guestImportInputSchema)
    .output(guestImportResultSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const { rows, ...options } = input
      const result: z.infer<typeof guestImportResultSchema> = { created: 0, merged: 0, consentKept: 0, errors: [] }
      for (const row of rows) {
        const parsed = guestCreateSchema.safeParse(guestFromImportRow(row, options))
        if (!parsed.success) {
          const issue = parsed.error.issues[0]
          result.errors.push({ line: row.line, message: `${issue?.path.join(".") || "row"}: ${issue?.message}` })
          continue
        }
        try {
          const { merged, consentKept } = await context.db.transaction((tx) =>
            upsertGuest(tx, hotelId, parsed.data, context.now(), context.user.id),
          )
          // No welcome on import: an old list would get a burst of welcomes for stays long past.
          if (consentKept) result.consentKept++
          if (merged) result.merged++
          else result.created++
        } catch {
          // The driver's error text can carry the phone number, so it is not logged.
          console.error("[guests.import] a row could not be saved")
          result.errors.push({ line: row.line, message: "Could not save this row." })
        }
      }
      await audit(context, {
        action: "guest.import",
        metadata: { hotelId, ...result, errors: result.errors.length, consentConfirmed: options.confirmConsent },
      })
      return result
    }),

  update: hotelProcedure
    .use(can({ guest: ["update"] }))
    .route({ method: "PATCH", path: "/guests/{id}", summary: "Update a guest's details", tags: ["guests"] })
    .input(guestUpdateSchema)
    .output(guestSchema)
    .handler(async ({ context, input: { id, phone, ...patch } }) => {
      const { hotelId } = context.hotel
      const current = await loadGuest(context.db, hotelId, id)
      if (!current.consents.profile && GUEST_EXTRA_FIELDS.some((field) => patch[field] != null)) {
        throw new ORPCError("BAD_REQUEST", { message: "Country, city and stay details need the guest's consent." })
      }
      if (patch.email === null && current.consents.email) {
        throw new ORPCError("BAD_REQUEST", { message: "Withdraw the email consent before removing the email." })
      }
      const touchesStay = patch.stayCheckIn !== undefined || patch.stayCheckOut !== undefined
      if (touchesStay && !isStayOrdered({ ...current, ...patch })) {
        throw new ORPCError("BAD_REQUEST", { message: STAY_ORDER_MESSAGE })
      }
      if (phone && phone !== current.phoneE164) {
        const { whatsappWithdrawn } = await updateWithNewPhone(
          context,
          { hotelId, staffUserId: context.user.id, guestId: id },
          { ...patch, phoneE164: phone },
        )
        // Never the numbers themselves: the audit log holds no guest contact details.
        await audit(context, { action: "guest.phone-change", targetId: id, metadata: { hotelId, whatsappWithdrawn } })
      } else if (Object.keys(patch).length) {
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
        await recordConsent(tx, { hotelId, ...input, at: context.now(), staffUserId: context.user.id })
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

  export: hotelExportProcedure
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
      return {
        exportedAt: context.now(),
        guest,
        consentEvents: await eventsOf(context.db, hotelId, [input.id]),
        feedback: await feedbackOfGuests(context.db, hotelId, input.id),
        whatsappScans: await scansForExport(context.db, hotelId, input.id),
      }
    }),

  exportAll: hotelExportProcedure
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
      const feedback = await feedbackOfGuests(context.db, hotelId, null)
      const whatsappScans = await scansForExport(context.db, hotelId, null)
      await audit(context, { action: "guest.export-all", metadata: { hotelId, count: all.length } })
      return {
        exportedAt: context.now(),
        guests: all.map((guest) => ({
          guest,
          consentEvents: events.filter((event) => event.guestId === guest.id),
          feedback: feedback.filter((item) => item.guestId === guest.id),
        })),
        // Hotel wide, so numbers that wrote without signing up are in it too.
        whatsappScans,
      }
    }),

  exportCsv: hotelExportProcedure
    .use(can({ guest: ["export"] }))
    .route({
      method: "GET",
      path: "/guests/export.csv",
      summary: "The guest list as csv, or one guest when `id` is given",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid().optional() }).default({}))
    .output(z.object({ filename: z.string(), csv: z.string() }))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const rows = await context.db
        .select()
        .from(guests)
        .where(input.id ? hotelGuest(hotelId, input.id) : eq(guests.hotelId, hotelId))
        .orderBy(guests.createdAt)
      if (input.id && !rows.length) throw notFound()
      const all = await withConsents(context.db, hotelId, rows)
      const events = await eventsOf(context.db, hotelId, input.id ? [input.id] : null)
      const feedback = await feedbackOfGuests(context.db, hotelId, input.id ?? null)
      const scans = await scansForExport(context.db, hotelId, input.id ?? null)
      await audit(context, {
        action: input.id ? "guest.export" : "guest.export-all",
        targetId: input.id,
        metadata: { hotelId, format: "csv", count: all.length },
      })
      const day = context.now().toISOString().slice(0, 10)
      return {
        filename: input.id ? `guest-${day}.csv` : `guests-${day}.csv`,
        csv: guestsToCsv(
          all.map((guest) => ({
            guest,
            consentEvents: events.filter((e) => e.guestId === guest.id),
            feedback: feedback.filter((f) => f.guestId === guest.id),
            whatsappScans: scans.filter((s) => s.phoneE164 === guest.phoneE164),
          })),
        ),
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
      const removed = await context.db.transaction(async (tx) => {
        await eraseFeedbackNotes(tx, hotelId, input.id)
        await eraseGuestScans(tx, hotelId, input.id)
        return tx.delete(guests).where(hotelGuest(hotelId, input.id)).returning({ id: guests.id })
      })
      if (!removed.length) throw notFound()
      const hash = hashGuestId(input.id)
      await audit(context, { action: "guest.delete", targetId: hash, metadata: { hotelId } })
      return { ok: true as const }
    }),

  removeAll: hotelProcedure
    .use(can({ guest: ["delete"] }))
    .route({
      method: "DELETE",
      path: "/guests",
      summary: "Delete every guest of the hotel and everything stored about them",
      tags: ["guests"],
    })
    .input(z.object({ confirmCount: z.number().int().min(0) }))
    .output(z.object({ deleted: z.number() }))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const deleted = await context.db.transaction(async (tx) => {
        const [total] = await tx.select({ n: count() }).from(guests).where(eq(guests.hotelId, hotelId))
        if ((total?.n ?? 0) !== input.confirmCount) {
          throw new ORPCError("CONFLICT", { message: "The guest list changed. Reload and confirm again." })
        }
        await eraseFeedbackNotes(tx, hotelId, null)
        await eraseGuestScans(tx, hotelId, null)
        return tx.delete(guests).where(eq(guests.hotelId, hotelId)).returning({ id: guests.id })
      })
      await audit(context, { action: "guest.delete-all", metadata: { hotelId, count: deleted.length } })
      return { deleted: deleted.length }
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

  activity: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/guests/{id}/activity",
      summary: "Stays, offers used and survey answers of one guest, newest first",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(guestActivitySchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      await loadGuest(context.db, hotelId, input.id)
      const [stays, offersUsed, surveys] = await Promise.all([
        context.db
          .select({ id: guestVisits.id, source: guestVisits.source, at: guestVisits.at })
          .from(guestVisits)
          .where(and(eq(guestVisits.hotelId, hotelId), eq(guestVisits.guestId, input.id)))
          .orderBy(desc(guestVisits.at))
          .limit(20),
        context.db
          .select({ id: offerRedemptions.id, title: offers.title, at: offerRedemptions.redeemedAt })
          .from(offerRedemptions)
          .innerJoin(offers, and(eq(offers.id, offerRedemptions.offerId), eq(offers.hotelId, offerRedemptions.hotelId)))
          .where(and(eq(offerRedemptions.hotelId, hotelId), eq(offerRedemptions.guestId, input.id)))
          .orderBy(desc(offerRedemptions.redeemedAt))
          .limit(20),
        context.db
          .select({
            id: surveyResponses.id,
            nps: surveyResponses.nps,
            ratingRooms: surveyResponses.ratingRooms,
            ratingCleanliness: surveyResponses.ratingCleanliness,
            ratingService: surveyResponses.ratingService,
            comment: surveyResponses.comment,
            at: surveyResponses.submittedAt,
          })
          .from(surveyResponses)
          .where(and(eq(surveyResponses.hotelId, hotelId), eq(surveyResponses.guestId, input.id)))
          .orderBy(desc(surveyResponses.submittedAt))
          .limit(20),
      ])
      return { stays, offers: offersUsed, surveys }
    }),

  messages: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/guests/{id}/messages",
      summary: "Messages sent to one guest, newest first. Never the text.",
      tags: ["guests"],
    })
    .input(z.object({ id: z.uuid() }))
    .output(z.array(guestMessageSchema))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      await loadGuest(context.db, hotelId, input.id)
      return context.db
        .select({
          id: messages.id,
          channel: messages.channel,
          templateKey: messages.templateKey,
          status: messages.status,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(and(eq(messages.hotelId, hotelId), eq(messages.guestId, input.id)))
        .orderBy(desc(messages.createdAt), messages.id)
        .limit(20)
    }),
}
