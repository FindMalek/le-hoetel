import { SURVEY_INVITE_DAYS, type SurveyAnswer, verifySurveyToken } from "@le-hoetel/common/survey"
import { guests, surveyInvites, surveyResponses } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import type { Context } from "../context"
import { hotelBranding } from "./hotel"

type Ctx = Pick<Context, "db" | "config" | "now">

export const surveyExpiry = (from: Date): Date => new Date(from.getTime() + SURVEY_INVITE_DAYS * 864e5)

async function openInvite(context: Ctx, token: string) {
  const subject = verifySurveyToken(context.config.tokenSecret, "survey", token)
  const [invite] = subject
    ? await context.db
        .select({
          id: surveyInvites.id,
          hotelId: surveyInvites.hotelId,
          guestId: surveyInvites.guestId,
          expiresAt: surveyInvites.expiresAt,
          language: guests.language,
          responseId: surveyResponses.id,
        })
        .from(surveyInvites)
        .innerJoin(guests, eq(guests.id, surveyInvites.guestId))
        .leftJoin(surveyResponses, eq(surveyResponses.inviteId, surveyInvites.id))
        .where(eq(surveyInvites.id, subject.inviteId))
    : []
  if (!subject || !invite || invite.hotelId !== subject.hotelId) {
    throw new ORPCError("NOT_FOUND", { message: "This link is not valid." })
  }
  return invite
}

export type SurveyState = "open" | "answered" | "expired"

/** What the public page shows: the hotel's branding and whether the invite can still be answered. Never the guest's name, phone or email. */
export async function surveyPage(context: Ctx, token: string) {
  const invite = await openInvite(context, token)
  const state: SurveyState = invite.responseId ? "answered" : invite.expiresAt <= context.now() ? "expired" : "open"
  return { hotel: await hotelBranding(context, invite.hotelId), language: invite.language, state }
}

/** One response per invite: a second submit (double tap, retry) changes nothing and still says `answered`. */
export async function submitSurvey(context: Ctx, token: string, answer: SurveyAnswer) {
  const invite = await openInvite(context, token)
  if (invite.responseId) return { state: "answered" as const }
  if (invite.expiresAt <= context.now()) throw new ORPCError("BAD_REQUEST", { message: "This survey has closed." })
  const [saved] = await context.db
    .insert(surveyResponses)
    .values({
      hotelId: invite.hotelId,
      guestId: invite.guestId,
      inviteId: invite.id,
      nps: answer.nps,
      ratingRooms: answer.rooms,
      ratingCleanliness: answer.cleanliness,
      ratingService: answer.service,
      comment: answer.comment || null,
      language: invite.language,
      submittedAt: context.now(),
    })
    .onConflictDoNothing()
    .returning({ id: surveyResponses.id })
  return { state: "answered" as const, responseId: saved?.id }
}
