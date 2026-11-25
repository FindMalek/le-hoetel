import { MESSAGE_CHANNELS } from "@ritorno/common/consent"
import { CAPTURE_SOURCES } from "@ritorno/common/schemas"
import { auditLog, guestConsents, guests, hotelSettings, messages, offerRedemptions } from "@ritorno/db"
import { and, count, eq, exists, gte, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { can, hotelProcedure } from "../procedures"

const period = z.object({ today: z.number(), week: z.number() })

export const overviewSchema = z.object({
  guests: period.extend({ total: z.number(), consented: z.number() }),
  messagesSent: period,
  offersRedeemed: period,
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
      summary: "Today and this week for the active hotel, and its first-run checklist",
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

      const zero = { today: 0, week: 0 }
      return {
        guests: {
          total: guestCounts?.total ?? 0,
          today: guestCounts?.today ?? 0,
          week: guestCounts?.week ?? 0,
          consented: guestCounts?.consented ?? 0,
        },
        messagesSent: messageCounts ?? zero,
        offersRedeemed: redeemCounts ?? zero,
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
