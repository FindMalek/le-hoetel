import type { HotelLanguage } from "@le-hoetel/common/hotel"
import {
  DEFAULT_LOW_SCORE_THRESHOLD,
  SURVEY_INVITE_DAYS,
  type SurveyAnswer,
  verifySurveyToken,
} from "@le-hoetel/common/survey"
import { feedbackCases, guests, hotelSettings, surveyInvites, surveyResponses } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import type { Context } from "../context"
import { hotelBranding } from "./hotel"
import { notifyManager } from "./manager-alerts"

type Ctx = Pick<Context, "db" | "config" | "now">
type AlertCtx = Ctx & Pick<Context, "notification">

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
export async function submitSurvey(context: AlertCtx, token: string, answer: SurveyAnswer) {
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
  if (saved && answer.nps <= (await lowScoreThreshold(context, invite.hotelId))) {
    await openFeedbackCase(context, { ...invite, responseId: saved.id }, answer).catch(() =>
      console.error("[survey] could not alert the manager"),
    )
  }
  return { state: "answered" as const, responseId: saved?.id }
}

async function lowScoreThreshold(context: Ctx, hotelId: string): Promise<number> {
  const [row] = await context.db
    .select({ value: hotelSettings.lowScoreThreshold })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, hotelId))
  return row?.value ?? DEFAULT_LOW_SCORE_THRESHOLD
}

const ALERT: Record<HotelLanguage, (a: { name: string; nps: number; comment: string; url: string }) => string> = {
  en: (a) => `${a.name} left ${a.nps}/10.${a.comment} Follow up: ${a.url}`,
  fr: (a) => `${a.name} a mis ${a.nps}/10.${a.comment} À traiter : ${a.url}`,
  ar: (a) => `${a.name} قيّم ${a.nps}/10.${a.comment} للمتابعة: ${a.url}`,
}

/** The unhappy guest lands in the feedback inbox as `new`, then the manager hears about it. Never a phone number or email in the text. */
async function openFeedbackCase(
  context: AlertCtx,
  invite: { hotelId: string; guestId: string; responseId: string },
  answer: SurveyAnswer,
) {
  const [made] = await context.db
    .insert(feedbackCases)
    .values({ hotelId: invite.hotelId, responseId: invite.responseId })
    .onConflictDoNothing()
    .returning({ id: feedbackCases.id })
  if (!made) return
  const [row] = await context.db
    .select({ name: guests.name, language: hotelSettings.defaultLanguage })
    .from(guests)
    .innerJoin(hotelSettings, eq(hotelSettings.organizationId, guests.hotelId))
    .where(eq(guests.id, invite.guestId))
  const comment = answer.comment ? ` "${answer.comment.slice(0, 140)}${answer.comment.length > 140 ? "…" : ""}"` : ""
  const text = ALERT[row?.language ?? "en"]({
    name: row?.name.split(/\s+/)[0] ?? "A guest",
    nps: answer.nps,
    comment,
    url: `${context.config.dashboardUrl.replace(/\/$/, "")}/feedback/${made.id}`,
  })
  await notifyManager(context, invite.hotelId, text)
}
