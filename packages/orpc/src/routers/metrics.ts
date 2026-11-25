import { GUEST_SOURCES } from "@le-hoetel/common/consent"
import {
  guestConsents,
  guests,
  hotelSettings,
  messages,
  offerCodes,
  offerRedemptions,
  surveyResponses,
} from "@le-hoetel/db"
import { and, avg, count, eq, gte, sql } from "drizzle-orm"
import { z } from "zod"
import { can, hotelProcedure } from "../procedures"

export const METRIC_PERIODS = [7, 30, 90] as const

const sourceCounts = z.record(z.enum(GUEST_SOURCES), z.number())

export const metricsSchema = z.object({
  days: z.number(),
  bucket: z.enum(["day", "week"]),
  captured: z.object({
    total: z.number(),
    bySource: sourceCounts,
    points: z.array(z.object({ start: z.string(), total: z.number(), bySource: sourceCounts })),
  }),
  consent: z.object({ guests: z.number(), email: z.number(), whatsapp: z.number() }),
  messages: z.object({ sent: z.number(), delivered: z.number(), failed: z.number() }),
  offers: z.object({ issued: z.number(), redeemed: z.number() }),
  reviewsRequested: z.number(),
  survey: z.object({ responses: z.number(), average: z.number().nullable(), unhappy: z.number() }),
})

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/** Today's date in the hotel's timezone, as a UTC midnight, so day arithmetic never crosses a DST edge. */
function localToday(now: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now)
  return new Date(`${parts}T00:00:00Z`)
}

/** Bucket starts (a day, or a Monday like Postgres `date_trunc('week')`) covering the last `days` local days. */
export function bucketStarts(today: Date, days: number): { bucket: "day" | "week"; starts: string[]; since: string } {
  const first = new Date(today)
  first.setUTCDate(first.getUTCDate() - (days - 1))
  const since = isoDay(first)
  const bucket = days <= 7 ? "day" : "week"
  const starts: string[] = []
  const cursor = new Date(first)
  if (bucket === "week") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7))
  while (cursor <= today) {
    starts.push(isoDay(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + (bucket === "day" ? 1 : 7))
  }
  return { bucket, starts, since }
}

export const metricsRouter = {
  get: hotelProcedure
    .use(can({ guest: ["read"] }))
    .route({
      method: "GET",
      path: "/metrics",
      summary: "Guests captured, consent, messages and offers over 7, 30 or 90 days",
      tags: ["hotel"],
    })
    .input(
      z.object({
        days: z.union(
          METRIC_PERIODS.map((days) => z.literal(days)) as [z.ZodLiteral<7>, z.ZodLiteral<30>, z.ZodLiteral<90>],
        ),
      }),
    )
    .output(metricsSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const [settings] = await context.db.select().from(hotelSettings).where(eq(hotelSettings.organizationId, hotelId))
      const tz = settings?.timezone ?? "UTC"
      const { bucket, starts, since: sinceDay } = bucketStarts(localToday(context.now(), tz), input.days)
      const since = sql`(${sinceDay}::timestamp at time zone ${tz})`
      const emptySources = () =>
        Object.fromEntries(GUEST_SOURCES.map((source) => [source, 0])) as Record<(typeof GUEST_SOURCES)[number], number>

      const bucketKey = sql<string>`to_char(date_trunc(${sql.raw(`'${bucket}'`)}, ${guests.createdAt} at time zone ${tz}), 'YYYY-MM-DD')`
      const capturedRows = await context.db
        .select({ start: bucketKey, source: guests.source, n: count() })
        .from(guests)
        .where(and(eq(guests.hotelId, hotelId), gte(guests.createdAt, since)))
        .groupBy(sql`1`, guests.source)
      const points = starts.map((start) => ({ start, total: 0, bySource: emptySources() }))
      const bySource = emptySources()
      for (const row of capturedRows) {
        const point = points.find((item) => item.start === row.start)
        if (point) {
          point.total += row.n
          point.bySource[row.source] += row.n
        }
        bySource[row.source] += row.n
      }

      const granted = (channel: "email" | "whatsapp") =>
        count(
          sql`case when exists (select 1 from ${guestConsents} where ${guestConsents.guestId} = ${guests.id} and ${guestConsents.hotelId} = ${hotelId} and ${guestConsents.channel} = ${channel} and ${guestConsents.granted}) then 1 end`,
        )
      const [consent] = await context.db
        .select({ guests: count(), email: granted("email"), whatsapp: granted("whatsapp") })
        .from(guests)
        .where(and(eq(guests.hotelId, hotelId), gte(guests.createdAt, since)))

      const [sent] = await context.db
        .select({
          sent: count(sql`case when ${messages.status} in ('sent', 'delivered') then 1 end`),
          delivered: count(sql`case when ${messages.status} = 'delivered' then 1 end`),
          failed: count(sql`case when ${messages.status} = 'failed' then 1 end`),
        })
        .from(messages)
        .where(and(eq(messages.hotelId, hotelId), gte(messages.createdAt, since)))

      const [issued] = await context.db
        .select({ n: count() })
        .from(offerCodes)
        .where(and(eq(offerCodes.hotelId, hotelId), gte(offerCodes.createdAt, since)))
      // Only redemptions of codes issued in the period, so the rate compares like with like.
      const [redeemed] = await context.db
        .select({ n: count() })
        .from(offerRedemptions)
        .innerJoin(
          offerCodes,
          and(
            eq(offerCodes.hotelId, offerRedemptions.hotelId),
            eq(offerCodes.offerId, offerRedemptions.offerId),
            eq(offerCodes.guestId, offerRedemptions.guestId),
          ),
        )
        .where(and(eq(offerRedemptions.hotelId, hotelId), gte(offerCodes.createdAt, since)))

      const [survey] = await context.db
        .select({
          responses: count(),
          average: avg(surveyResponses.nps),
          unhappy: count(sql`case when ${surveyResponses.nps} <= 6 then 1 end`),
          reviews: count(surveyResponses.reviewLinkClickedAt),
        })
        .from(surveyResponses)
        .where(and(eq(surveyResponses.hotelId, hotelId), gte(surveyResponses.submittedAt, since)))

      return {
        days: input.days,
        bucket,
        captured: { total: points.reduce((sum, point) => sum + point.total, 0), bySource, points },
        consent: { guests: consent?.guests ?? 0, email: consent?.email ?? 0, whatsapp: consent?.whatsapp ?? 0 },
        messages: { sent: sent?.sent ?? 0, delivered: sent?.delivered ?? 0, failed: sent?.failed ?? 0 },
        offers: { issued: issued?.n ?? 0, redeemed: redeemed?.n ?? 0 },
        reviewsRequested: survey?.reviews ?? 0,
        survey: {
          responses: survey?.responses ?? 0,
          average: survey?.average ? Math.round(Number(survey.average) * 10) / 10 : null,
          unhappy: survey?.unhappy ?? 0,
        },
      }
    }),
}
