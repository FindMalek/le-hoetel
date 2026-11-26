import { ORPCError } from "@orpc/server"
import type { HotelLanguage } from "@ritorno/common/hotel"
import {
  DEFAULT_LOW_SCORE_THRESHOLD,
  SURVEY_INVITE_DAYS,
  type SurveyAnswer,
  signSurveyToken,
  verifySurveyToken,
} from "@ritorno/common/survey"
import { feedbackCases, guests, hotelSettings, surveyInvites, surveyResponses } from "@ritorno/db"
import type { TemplateData } from "@ritorno/notification"
import { and, eq, isNull } from "drizzle-orm"
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
  const reviewToken = state === "answered" && (await reviewUrl(context, invite.hotelId))
  return {
    hotel: await hotelBranding(context, invite.hotelId),
    language: invite.language,
    state,
    reviewToken: reviewToken
      ? signSurveyToken(context.config.tokenSecret, "review", { hotelId: invite.hotelId, inviteId: invite.id })
      : null,
  }
}

async function reviewUrl(context: Ctx, hotelId: string): Promise<string | null> {
  const [row] = await context.db
    .select({ url: hotelSettings.googleReviewUrl })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, hotelId))
  return row?.url || null
}

/** The signed redirect behind "Share on Google": the first click is stamped on the response, every click goes on to the hotel's page. Offered after every score, never gated. */
export async function reviewClick(context: Ctx, token: string): Promise<{ url: string }> {
  const subject = verifySurveyToken(context.config.tokenSecret, "review", token)
  const url = subject ? await reviewUrl(context, subject.hotelId) : null
  if (!subject || !url) throw new ORPCError("NOT_FOUND", { message: "This link is not valid." })
  await context.db
    .update(surveyResponses)
    .set({ reviewLinkClickedAt: context.now() })
    .where(
      and(
        eq(surveyResponses.inviteId, subject.inviteId),
        eq(surveyResponses.hotelId, subject.hotelId),
        isNull(surveyResponses.reviewLinkClickedAt),
      ),
    )
  return { url }
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

interface AlertInput {
  hotel: string
  name: string
  nps: number
  comment: string
  url: string
}

/** The manager's low score alert, in the hotel's language: first name, score and comment only, never contact details. */
const ALERT: Record<HotelLanguage, (a: AlertInput) => { text: string; email: Omit<TemplateData<"alert">, "locale"> }> =
  {
    en: (a) => ({
      text: `${a.name} left ${a.nps}/10.${a.comment ? ` "${a.comment}"` : ""} Follow up: ${a.url}`,
      email: {
        eyebrow: "Low score alert",
        title: `Low score from ${a.name}`,
        intro: `${a.name} left ${a.nps}/10 after their stay.`,
        items: [
          { label: "Hotel", value: a.hotel },
          { label: "Score", value: `${a.nps}/10` },
          ...(a.comment ? [{ label: "Comment", value: a.comment }] : []),
        ],
        url: a.url,
        cta: "Follow up",
      },
    }),
    fr: (a) => ({
      text: `${a.name} a mis ${a.nps}/10.${a.comment ? ` "${a.comment}"` : ""} À traiter : ${a.url}`,
      email: {
        eyebrow: "Alerte note basse",
        title: `Note basse de ${a.name}`,
        intro: `${a.name} a mis ${a.nps}/10 après son séjour.`,
        items: [
          { label: "Hôtel", value: a.hotel },
          { label: "Note", value: `${a.nps}/10` },
          ...(a.comment ? [{ label: "Commentaire", value: a.comment }] : []),
        ],
        url: a.url,
        cta: "Traiter",
      },
    }),
    ar: (a) => ({
      text: `${a.name} قيّم ${a.nps}/10.${a.comment ? ` "${a.comment}"` : ""} للمتابعة: ${a.url}`,
      email: {
        eyebrow: "تنبيه تقييم منخفض",
        title: `تقييم منخفض من ${a.name}`,
        intro: `${a.name} قيّم ${a.nps}/10 بعد الإقامة.`,
        items: [
          { label: "الفندق", value: a.hotel },
          { label: "التقييم", value: `${a.nps}/10` },
          ...(a.comment ? [{ label: "التعليق", value: a.comment }] : []),
        ],
        url: a.url,
        cta: "للمتابعة",
      },
    }),
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
    .select({ name: guests.name, language: hotelSettings.defaultLanguage, hotel: hotelSettings.displayName })
    .from(guests)
    .innerJoin(hotelSettings, eq(hotelSettings.organizationId, guests.hotelId))
    .where(eq(guests.id, invite.guestId))
  const comment = answer.comment ? `${answer.comment.slice(0, 140)}${answer.comment.length > 140 ? "…" : ""}` : ""
  const language = row?.language ?? "en"
  const { text, email } = ALERT[language]({
    hotel: row?.hotel ?? "",
    name: row?.name.split(/\s+/)[0] ?? "A guest",
    nps: answer.nps,
    comment,
    url: `${context.config.dashboardUrl.replace(/\/$/, "")}/feedback/${made.id}`,
  })
  await notifyManager(context, invite.hotelId, text, { ...email, locale: language })
}
