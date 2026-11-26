import { type Db, feedbackCases, guests, surveyResponses } from "@ritorno/db"
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm"

/** The follow-up of a hotel's unhappy answers, for the guest data exports. `guestId` null is every guest. */
export function feedbackOfGuests(db: Db, hotelId: string, guestId: string | null) {
  return db
    .select({
      guestId: surveyResponses.guestId,
      status: feedbackCases.status,
      notes: feedbackCases.notes,
      nps: surveyResponses.nps,
      comment: surveyResponses.comment,
      submittedAt: surveyResponses.submittedAt,
      updatedAt: feedbackCases.updatedAt,
    })
    .from(feedbackCases)
    .innerJoin(surveyResponses, eq(surveyResponses.id, feedbackCases.responseId))
    .where(
      and(
        eq(feedbackCases.hotelId, hotelId),
        guestId ? eq(surveyResponses.guestId, guestId) : isNotNull(surveyResponses.guestId),
      ),
    )
    .orderBy(desc(surveyResponses.submittedAt))
}

/**
 * Staff notes are about a person, so they go when the guest does (the survey answer stays, anonymous).
 * Call it inside the delete's transaction, before the guest row goes: afterwards the response no longer points at
 * the guest. It locks the guest rows first, so a case being saved finishes before or finds the guest gone.
 */
export async function eraseFeedbackNotes(
  db: Pick<Db, "select" | "update">,
  hotelId: string,
  guestId: string | null,
): Promise<void> {
  await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.hotelId, hotelId), guestId ? eq(guests.id, guestId) : undefined))
    .orderBy(guests.id)
    .for("update")
  const ofGuest = guestId
    ? inArray(
        feedbackCases.responseId,
        db.select({ id: surveyResponses.id }).from(surveyResponses).where(eq(surveyResponses.guestId, guestId)),
      )
    : undefined
  await db
    .update(feedbackCases)
    .set({ notes: null })
    .where(and(eq(feedbackCases.hotelId, hotelId), ofGuest))
}
