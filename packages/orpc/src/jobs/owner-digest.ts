import { isQuietHour, localTime } from "@ritorno/common/hotel-time"
import {
  feedbackCases,
  guests,
  guestVisits,
  hotelSettings,
  member,
  messages,
  offerRedemptions,
  surveyResponses,
  user,
} from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { type OwnerDigestData, renderTemplate } from "@ritorno/notification"
import { type AnyColumn, and, avg, count, countDistinct, eq, inArray, isNull, like, lt, ne, or, sql } from "drizzle-orm"
import { z } from "zod"
import { SEND_PACING, type SendPacing, sleep } from "../lib/automations"
import { isRetryableSendError } from "../lib/messages"
import type { JobServices } from "./welcome"

export const OWNER_DIGEST_JOB = "owner-digest"

const MONDAY = 1
const FROM_HOUR = 9

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10)

/**
 * Runs every hour. On Monday, from 09:00 until quiet hours in the hotel's timezone, each hotel's owners get the
 * counts of the Monday to Sunday that just ended. `last_digest_week` is claimed before sending, so a rerun or a
 * second worker never sends the week twice. Only a retryable provider error gives the claim back for the next hour,
 * where the same idempotency key makes Resend drop what it already accepted.
 */
export const ownerDigestJob = (services: JobServices, pacing: SendPacing = SEND_PACING) =>
  defineJob({
    name: OWNER_DIGEST_JOB,
    description: "Email hotel owners their weekly summary",
    payload: z.object({}),
    cron: "5 * * * *",
    scheduleData: {},
    handler: async (_payload, { now }) => {
      const hotels = await services.db
        .select({
          hotelId: hotelSettings.organizationId,
          timezone: hotelSettings.timezone,
          name: hotelSettings.displayName,
          locale: hotelSettings.defaultLanguage,
          lastWeek: hotelSettings.lastDigestWeek,
        })
        .from(hotelSettings)
        .where(and(ne(hotelSettings.status, "suspended"), eq(hotelSettings.weeklyDigest, true)))
      for (const hotel of hotels) {
        try {
          const local = localTime(now(), hotel.timezone)
          const monday = new Date(`${local.date}T00:00:00Z`).getUTCDay() === MONDAY
          if (!monday || local.hour < FROM_HOUR || isQuietHour(local.hour)) continue
          await sendDigest(services, hotel, local.date, pacing)
        } catch {
          // Never the error itself: a provider message can carry the owner's address.
          console.error("[owner-digest] failed", { hotelId: hotel.hotelId })
        }
      }
    },
  })

interface Hotel {
  hotelId: string
  timezone: string
  name: string
  locale: OwnerDigestData["locale"]
  lastWeek: string | null
}

async function sendDigest(services: JobServices, hotel: Hotel, week: string, pacing: SendPacing) {
  const { db } = services
  const { hotelId } = hotel
  if (hotel.lastWeek && hotel.lastWeek >= week) return
  const owners = await db
    .select({ id: user.id, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, hotelId),
        like(member.role, "%owner%"),
        or(isNull(user.banned), eq(user.banned, false)),
      ),
    )
  if (!owners.length) return
  const dashboardUrl = services.config.dashboardUrl.replace(/\/$/, "")
  const settingsUrl = `${dashboardUrl}/hotel?hotel=${encodeURIComponent(hotelId)}#weekly-digest`
  const email = await renderTemplate(
    "ownerDigest",
    {
      ...(await weekNumbers(services, hotel, week)),
      locale: hotel.locale,
      hotel: hotel.name,
      url: dashboardUrl,
      settingsUrl,
    },
    dashboardUrl,
  )
  // Claimed only once the email is built, so a failure up to here leaves the week for the next run.
  // `updatedAt` is kept: sending a digest is not an edit of the hotel.
  const mark = (value: string | null) => ({ lastDigestWeek: value, updatedAt: sql`${hotelSettings.updatedAt}` })
  const [claimed] = await db
    .update(hotelSettings)
    .set(mark(week))
    .where(
      and(
        eq(hotelSettings.organizationId, hotelId),
        or(isNull(hotelSettings.lastDigestWeek), lt(hotelSettings.lastDigestWeek, week)),
      ),
    )
    .returning({ hotelId: hotelSettings.organizationId })
  if (!claimed) return

  let retry = false
  for (const owner of owners) {
    try {
      await services.notification.sendEmail({
        to: owner.email,
        email,
        headers: { "List-Unsubscribe": `<${settingsUrl}>` },
        idempotencyKey: `owner-digest:${hotelId}:${week}:${owner.id}`,
      })
    } catch (error) {
      retry ||= isRetryableSendError(error, true)
      console.error("[owner-digest] send failed", { hotelId })
    }
    await sleep(pacing.pauseMs)
  }
  if (retry) await db.update(hotelSettings).set(mark(null)).where(eq(hotelSettings.organizationId, hotelId))
}

/** The Monday to Sunday before `week`, against the seven days before that, in hotel time. */
async function weekNumbers({ db }: JobServices, { hotelId, timezone }: Hotel, week: string) {
  const midnight = (date: string) => sql`(${date}::date::timestamp at time zone ${timezone})`
  const [before, start, end] = [midnight(addDays(week, -14)), midnight(addDays(week, -7)), midnight(week)]
  const current = (at: AnyColumn) => sql`${at} >= ${start} and ${at} < ${end}`
  const previous = (at: AnyColumn) => sql`${at} >= ${before} and ${at} < ${start}`
  const split = (at: AnyColumn) => ({
    current: count(sql`case when ${current(at)} then 1 end`),
    previous: count(sql`case when ${previous(at)} then 1 end`),
  })

  const [newGuests] = await db.select(split(guests.createdAt)).from(guests).where(eq(guests.hotelId, hotelId))
  const earlier = sql`exists (select 1 from ${guestVisits} as prior where prior.guest_id = ${guestVisits.guestId} and prior.at < ${guestVisits.at})`
  const returned = (range: ReturnType<typeof current>) =>
    countDistinct(sql`case when ${earlier} and ${range} then ${guestVisits.guestId} end`)
  const [returningGuests] = await db
    .select({ current: returned(current(guestVisits.at)), previous: returned(previous(guestVisits.at)) })
    .from(guestVisits)
    .where(eq(guestVisits.hotelId, hotelId))
  const [messagesSent] = await db
    .select(split(messages.createdAt))
    .from(messages)
    .where(and(eq(messages.hotelId, hotelId), inArray(messages.status, ["sent", "delivered"])))
  const [offersRedeemed] = await db
    .select(split(offerRedemptions.redeemedAt))
    .from(offerRedemptions)
    .where(eq(offerRedemptions.hotelId, hotelId))
  const [survey] = await db
    .select({
      ...split(surveyResponses.submittedAt),
      score: avg(sql`case when ${current(surveyResponses.submittedAt)} then ${surveyResponses.nps} end`),
    })
    .from(surveyResponses)
    .where(eq(surveyResponses.hotelId, hotelId))
  const [open] = await db
    .select({ n: count() })
    .from(feedbackCases)
    .innerJoin(surveyResponses, eq(surveyResponses.id, feedbackCases.responseId))
    .innerJoin(guests, and(eq(guests.id, surveyResponses.guestId), eq(guests.hotelId, hotelId)))
    .where(and(eq(feedbackCases.hotelId, hotelId), eq(feedbackCases.status, "new")))

  const none = { current: 0, previous: 0 }
  return {
    from: addDays(week, -7),
    to: addDays(week, -1),
    newGuests: newGuests ?? none,
    returningGuests: returningGuests ?? none,
    messagesSent: messagesSent ?? none,
    offersRedeemed: offersRedeemed ?? none,
    surveyResponses: { current: survey?.current ?? 0, previous: survey?.previous ?? 0 },
    score: survey?.score == null ? null : Math.round(Number(survey.score) * 10) / 10,
    openCases: open?.n ?? 0,
  }
}
