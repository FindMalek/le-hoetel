import { ORPCError } from "@orpc/server"
import { FEEDBACK_CASE_STATUSES, FEEDBACK_NOTES_MAX } from "@ritorno/common/feedback-case"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { feedbackCases, guests, surveyResponses, user } from "@ritorno/db"
import { and, count, desc, eq } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { can, hotelProcedure } from "../procedures"

const status = z.enum(FEEDBACK_CASE_STATUSES)

const caseRow = z.object({
  id: z.string(),
  status,
  name: z.string(),
  nps: z.number(),
  comment: z.string().nullable(),
  createdAt: z.date(),
})

const caseDetail = caseRow.extend({
  notes: z.string().nullable(),
  /** The staff member who saved it last. */
  handledBy: z.string().nullable(),
  updatedAt: z.date(),
  ratingRooms: z.number().nullable(),
  ratingCleanliness: z.number().nullable(),
  ratingService: z.number().nullable(),
  guest: z.object({
    id: z.string(),
    phoneE164: z.string(),
    email: z.string().nullable(),
    language: z.enum(HOTEL_LANGUAGES),
  }),
})

const columns = {
  id: feedbackCases.id,
  status: feedbackCases.status,
  name: guests.name,
  nps: surveyResponses.nps,
  comment: surveyResponses.comment,
  createdAt: feedbackCases.createdAt,
}

/** Cases of this hotel whose guest still exists: a deleted guest leaves nobody to follow up with. */
const ofGuests = (hotelId: string) => ({
  response: eq(surveyResponses.id, feedbackCases.responseId),
  guest: and(eq(guests.id, surveyResponses.guestId), eq(guests.hotelId, hotelId)),
})

const notFound = () => new ORPCError("NOT_FOUND", { message: "No such case." })

async function loadCase(db: Context["db"], hotelId: string, id: string) {
  const on = ofGuests(hotelId)
  const [row] = await db
    .select({
      ...columns,
      notes: feedbackCases.notes,
      handledBy: user.name,
      updatedAt: feedbackCases.updatedAt,
      ratingRooms: surveyResponses.ratingRooms,
      ratingCleanliness: surveyResponses.ratingCleanliness,
      ratingService: surveyResponses.ratingService,
      guest: { id: guests.id, phoneE164: guests.phoneE164, email: guests.email, language: guests.language },
    })
    .from(feedbackCases)
    .innerJoin(surveyResponses, on.response)
    .innerJoin(guests, on.guest)
    .leftJoin(user, eq(user.id, feedbackCases.handledBy))
    .where(and(eq(feedbackCases.id, id), eq(feedbackCases.hotelId, hotelId)))
  if (!row) throw notFound()
  return row
}

/** The feedback inbox of unhappy guests. Not `feedback`, which is the product feedback widget. */
export const feedbackCasesRouter = {
  list: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/feedback-cases",
      summary: "Unhappy guests to follow up, newest first, with a count per status",
      tags: ["feedback"],
    })
    .input(
      z
        .object({
          status: status.optional(),
          limit: z.coerce.number().int().min(1).max(100).default(25),
          offset: z.coerce.number().int().min(0).default(0),
        })
        .prefault({}),
    )
    .output(
      z.object({
        items: z.array(caseRow),
        total: z.number(),
        counts: z.record(status, z.number()),
      }),
    )
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const on = ofGuests(hotelId)
      const grouped = await context.db
        .select({ status: feedbackCases.status, n: count() })
        .from(feedbackCases)
        .innerJoin(surveyResponses, on.response)
        .innerJoin(guests, on.guest)
        .where(eq(feedbackCases.hotelId, hotelId))
        .groupBy(feedbackCases.status)
      const counts = { new: 0, contacted: 0, resolved: 0 }
      for (const row of grouped) counts[row.status] = row.n
      const items = await context.db
        .select(columns)
        .from(feedbackCases)
        .innerJoin(surveyResponses, on.response)
        .innerJoin(guests, on.guest)
        .where(
          and(eq(feedbackCases.hotelId, hotelId), input.status ? eq(feedbackCases.status, input.status) : undefined),
        )
        .orderBy(desc(feedbackCases.createdAt), feedbackCases.id)
        .limit(input.limit)
        .offset(input.offset)
      const total = input.status ? counts[input.status] : counts.new + counts.contacted + counts.resolved
      return { items, total, counts }
    }),

  get: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({ method: "GET", path: "/feedback-cases/{id}", summary: "One unhappy guest case", tags: ["feedback"] })
    .input(z.object({ id: z.uuid() }))
    .output(caseDetail)
    .handler(({ context, input }) => loadCase(context.db, context.hotel.hotelId, input.id)),

  update: hotelProcedure
    .use(can({ guest: ["update"] }))
    .route({
      method: "PATCH",
      path: "/feedback-cases/{id}",
      summary: "Set the status or the staff notes of a case",
      tags: ["feedback"],
    })
    .input(
      z.object({
        id: z.uuid(),
        status: status.optional(),
        notes: z.string().trim().max(FEEDBACK_NOTES_MAX).optional(),
      }),
    )
    .output(caseDetail)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      await loadCase(context.db, hotelId, input.id)
      await context.db
        .update(feedbackCases)
        .set({
          status: input.status,
          notes: input.notes === undefined ? undefined : input.notes || null,
          handledBy: context.user.id,
        })
        .where(and(eq(feedbackCases.id, input.id), eq(feedbackCases.hotelId, hotelId)))
      // Never the note text: it can name the guest.
      await audit(context, {
        action: "feedback-case.update",
        targetId: input.id,
        metadata: { hotelId, status: input.status, notes: input.notes !== undefined },
      })
      return loadCase(context.db, hotelId, input.id)
    }),
}
