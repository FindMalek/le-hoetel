import { type Db, feedbackCases, surveyResponses } from "@ritorno/db"
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
 * Call it before the guest row is deleted: afterwards the response no longer points at the guest.
 */
export async function eraseFeedbackNotes(
  db: Pick<Db, "select" | "update">,
  hotelId: string,
  guestId: string | null,
): Promise<void> {
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
