import { MESSAGE_CHANNELS } from "@ritorno/common/consent"
import { CAPTURE_SOURCES } from "@ritorno/common/schemas"
import {
  auditLog,
  feedbackCases,
  guestConsents,
  guests,
  guestVisits,
  hotelSettings,
  messages,
  offerRedemptions,
  surveyResponses,
} from "@ritorno/db"
import { and, avg, count, countDistinct, desc, eq, exists, gte, inArray, lt, sql } from "drizzle-orm"
import { z } from "zod"
import { can, hotelProcedure } from "../procedures"

const period = z.object({ today: z.number(), week: z.number() })
const versus = z.object({ current: z.number(), previous: z.number() })
const ALERTS_SHOWN = 5

export const overviewSchema = z.object({
  guests: period.extend({ total: z.number(), consented: z.number() }),
  messagesSent: period,
  offersRedeemed: period,
  /** The last 7 days against the 7 before, for the home KPIs. */
  lastWeek: z.object({
    guests: versus,
    returning: versus,
    offersRedeemed: versus,
    survey: z.object({ current: z.number().nullable(), previous: z.number().nullable(), responses: z.number() }),
  }),
  /** Low score cases nobody has picked up yet, newest first. */
  alerts: z.object({
    open: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        guestId: z.string(),
        name: z.string(),
        phoneE164: z.string(),
        nps: z.number(),
        comment: z.string().nullable(),
        createdAt: z.date(),
      }),
    ),
  }),
  checklist: z.object({
    logo: z.boolean(),
    colors: z.boolean(),
    googleLink: z.boolean(),
    qr: z.boolean(),
    guests: z.boolean(),
    testEmail: z.boolean(),
  }),
})

export const TEST_EMAIL_ACTION = "email.send-test"

export const overviewRouter = {
  get: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/overview",
      summary: "Today, the last 7 days against the 7 before, open low score alerts and the first-run checklist",
      tags: ["hotel"],
    })
    .output(overviewSchema)
    .handler(async ({ context }) => {
      const { hotelId } = context.hotel
      const [settings] = await context.db.select().from(hotelSettings).where(eq(hotelSettings.organizationId, hotelId))
      const tz = settings?.timezone ?? "UTC"
      const startOfToday = sql`date_trunc('day', now() at time zone ${tz}) at time zone ${tz}`
      const weekAgo = sql`now() - interval '7 days'`
      const since = (column: Parameters<typeof gte>[0], from: ReturnType<typeof sql>) =>
        count(sql`case when ${gte(column, from)} then 1 end`)

      const consentedGuest = exists(
        context.db
          .select({ one: sql`1` })
          .from(guestConsents)
          .where(
            and(
              eq(guestConsents.guestId, guests.id),
              eq(guestConsents.hotelId, hotelId),
              eq(guestConsents.granted, true),
              inArray(guestConsents.channel, MESSAGE_CHANNELS.slice()),
            ),
          ),
      )
      const [guestCounts] = await context.db
        .select({
          total: count(),
          today: since(guests.createdAt, startOfToday),
          week: since(guests.createdAt, weekAgo),
          consented: count(sql`case when ${consentedGuest} then 1 end`),
          qr: count(sql`case when ${inArray(guests.source, Object.values(CAPTURE_SOURCES))} then 1 end`),
        })
        .from(guests)
        .where(eq(guests.hotelId, hotelId))

      const [messageCounts] = await context.db
        .select({ today: since(messages.createdAt, startOfToday), week: since(messages.createdAt, weekAgo) })
        .from(messages)
        .where(and(eq(messages.hotelId, hotelId), inArray(messages.status, ["sent", "delivered"])))

      const [redeemCounts] = await context.db
        .select({
          today: since(offerRedemptions.redeemedAt, startOfToday),
          week: since(offerRedemptions.redeemedAt, weekAgo),
        })
        .from(offerRedemptions)
        .where(eq(offerRedemptions.hotelId, hotelId))

      const [testEmails] = await context.db
        .select({ n: count() })
        .from(auditLog)
        .where(and(eq(auditLog.action, TEST_EMAIL_ACTION), sql`${auditLog.metadata}->>'hotelId' = ${hotelId}`))

      const twoWeeksAgo = sql`now() - interval '14 days'`
      const inWeeks = (column: Parameters<typeof gte>[0]) => ({
        current: since(column, weekAgo),
        previous: count(sql`case when ${gte(column, twoWeeksAgo)} and ${lt(column, weekAgo)} then 1 end`),
      })
      const [lastGuests] = await context.db
        .select(inWeeks(guests.createdAt))
        .from(guests)
        .where(and(eq(guests.hotelId, hotelId), gte(guests.createdAt, twoWeeksAgo)))
      const [lastRedeemed] = await context.db
        .select(inWeeks(offerRedemptions.redeemedAt))
        .from(offerRedemptions)
        .where(and(eq(offerRedemptions.hotelId, hotelId), gte(offerRedemptions.redeemedAt, twoWeeksAgo)))

      // A returning guest came back in the window after an earlier visit, counted once.
      const earlier = sql`exists (select 1 from ${guestVisits} as prior where prior.guest_id = ${guestVisits.guestId} and prior.at < ${guestVisits.at})`
      const returningIn = (from: ReturnType<typeof sql>, to?: ReturnType<typeof sql>) =>
        countDistinct(
          sql`case when ${earlier} and ${gte(guestVisits.at, from)}${to ? sql` and ${lt(guestVisits.at, to)}` : sql``} then ${guestVisits.guestId} end`,
        )
      const [lastReturning] = await context.db
        .select({ current: returningIn(weekAgo), previous: returningIn(twoWeeksAgo, weekAgo) })
        .from(guestVisits)
        .where(and(eq(guestVisits.hotelId, hotelId), gte(guestVisits.at, twoWeeksAgo)))

      const scoreIn = (from: ReturnType<typeof sql>, to?: ReturnType<typeof sql>) =>
        avg(
          sql`case when ${gte(surveyResponses.submittedAt, from)}${to ? sql` and ${lt(surveyResponses.submittedAt, to)}` : sql``} then ${surveyResponses.nps} end`,
        )
      const [lastSurvey] = await context.db
        .select({
          current: scoreIn(weekAgo),
          previous: scoreIn(twoWeeksAgo, weekAgo),
          responses: since(surveyResponses.submittedAt, weekAgo),
        })
        .from(surveyResponses)
        .where(and(eq(surveyResponses.hotelId, hotelId), gte(surveyResponses.submittedAt, twoWeeksAgo)))
      const score = (value: string | null | undefined) => (value == null ? null : Math.round(Number(value) * 10) / 10)

      const openCase = and(eq(feedbackCases.hotelId, hotelId), eq(feedbackCases.status, "new"))
      const alertRows = context.db
        .select({
          id: feedbackCases.id,
          guestId: guests.id,
          name: guests.name,
          phoneE164: guests.phoneE164,
          nps: surveyResponses.nps,
          comment: surveyResponses.comment,
          createdAt: feedbackCases.createdAt,
        })
        .from(feedbackCases)
        .innerJoin(surveyResponses, eq(surveyResponses.id, feedbackCases.responseId))
        .innerJoin(guests, and(eq(guests.id, surveyResponses.guestId), eq(guests.hotelId, hotelId)))
        .where(openCase)
      const [alertItems, [openCount]] = await Promise.all([
        alertRows.orderBy(desc(feedbackCases.createdAt)).limit(ALERTS_SHOWN),
        context.db
          .select({ n: count() })
          .from(feedbackCases)
          .innerJoin(surveyResponses, eq(surveyResponses.id, feedbackCases.responseId))
          .innerJoin(guests, and(eq(guests.id, surveyResponses.guestId), eq(guests.hotelId, hotelId)))
          .where(openCase),
      ])

      const zero = { today: 0, week: 0 }
      const none = { current: 0, previous: 0 }
      return {
        guests: {
          total: guestCounts?.total ?? 0,
          today: guestCounts?.today ?? 0,
          week: guestCounts?.week ?? 0,
          consented: guestCounts?.consented ?? 0,
        },
        messagesSent: messageCounts ?? zero,
        offersRedeemed: redeemCounts ?? zero,
        lastWeek: {
          guests: lastGuests ?? none,
          returning: lastReturning ?? none,
          offersRedeemed: lastRedeemed ?? none,
          survey: {
            current: score(lastSurvey?.current),
            previous: score(lastSurvey?.previous),
            responses: lastSurvey?.responses ?? 0,
          },
        },
        alerts: { open: openCount?.n ?? 0, items: alertItems },
        checklist: {
          logo: !!settings?.logoKey,
          colors: !!settings?.primaryColor,
          googleLink: !!settings?.googleReviewUrl,
          qr: (guestCounts?.qr ?? 0) > 0,
          guests: (guestCounts?.total ?? 0) > 0,
          testEmail: (testEmails?.n ?? 0) > 0,
        },
      }
    }),
}
