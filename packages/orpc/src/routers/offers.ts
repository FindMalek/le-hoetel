import { ORPCError } from "@orpc/server"
import {
  offerCodeInputSchema,
  offerCreateSchema,
  offerLookupSchema,
  offerSchema,
  offerUpdateSchema,
  redemptionStatsSchema,
} from "@ritorno/common/schemas"
import { guests, hotelSettings, offerRedemptions, offers, user } from "@ritorno/db"
import { and, count, desc, eq, getTableColumns, sql } from "drizzle-orm"
import { z } from "zod"
import { audit } from "../lib/audit"
import { firstName, lookupCode, redeemCode } from "../lib/offers"
import { can, hotelProcedure } from "../procedures"

const notFound = () => new ORPCError("NOT_FOUND", { message: "Offer not found." })
const codeTaken = () => new ORPCError("CONFLICT", { message: "That promo code is already used by another offer." })

const isUniqueViolation = (error: unknown): boolean =>
  [error, (error as { cause?: unknown } | null)?.cause].some((e) => (e as { code?: string } | null)?.code === "23505")

const redeemedOf = sql<number>`(select count(*)::int from "offer_redemptions" r where r."offer_id" = "offers"."id")`

const withRedeemed = { ...getTableColumns(offers), redeemed: redeemedOf.as("redeemed") }

export const offersRouter = {
  list: hotelProcedure
    .use(can({ offer: ["read"] }))
    .route({ method: "GET", path: "/offers", summary: "The active hotel's offers", tags: ["offers"] })
    .output(z.array(offerSchema))
    .handler(({ context }) =>
      context.db
        .select(withRedeemed)
        .from(offers)
        .where(eq(offers.hotelId, context.hotel.hotelId))
        .orderBy(desc(offers.active), desc(offers.createdAt)),
    ),

  create: hotelProcedure
    .use(can({ offer: ["create"] }))
    .route({ method: "POST", path: "/offers", summary: "Create an offer", tags: ["offers"] })
    .input(offerCreateSchema)
    .output(offerSchema)
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .insert(offers)
        .values({ ...input, validFrom: input.validFrom ?? context.now(), hotelId: context.hotel.hotelId })
        .returning()
        .catch((error) => {
          throw isUniqueViolation(error) ? codeTaken() : error
        })
      await audit(context, { action: "offer.create", targetId: row!.id })
      return { ...row!, redeemed: 0 }
    }),

  update: hotelProcedure
    .use(can({ offer: ["update"] }))
    .route({ method: "PATCH", path: "/offers/{id}", summary: "Change an offer", tags: ["offers"] })
    .input(offerUpdateSchema)
    .output(offerSchema)
    .handler(async ({ context, input }) => {
      const { id, ...patch } = input
      const where = and(eq(offers.id, id), eq(offers.hotelId, context.hotel.hotelId))
      const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
      if (Object.keys(defined).length) {
        const updated = await context.db
          .update(offers)
          .set(defined)
          .where(where)
          .returning({ id: offers.id })
          .catch((error) => {
            throw isUniqueViolation(error) ? codeTaken() : error
          })
        if (!updated.length) throw notFound()
        await audit(context, { action: "offer.update", targetId: id })
      }
      const [row] = await context.db.select(withRedeemed).from(offers).where(where)
      if (!row) throw notFound()
      return row
    }),

  delete: hotelProcedure
    .use(can({ offer: ["delete"] }))
    .route({ method: "DELETE", path: "/offers/{id}", summary: "Delete an offer and its redemptions", tags: ["offers"] })
    .input(z.object({ id: z.uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const deleted = await context.db
        .delete(offers)
        .where(and(eq(offers.id, input.id), eq(offers.hotelId, context.hotel.hotelId)))
        .returning({ id: offers.id })
      if (!deleted.length) throw notFound()
      await audit(context, { action: "offer.delete", targetId: input.id })
      return { ok: true as const }
    }),

  lookup: hotelProcedure
    .use(can({ offer: ["redeem"] }))
    .route({
      method: "POST",
      path: "/offers/lookup",
      summary: "What a scanned or typed code is worth",
      tags: ["offers"],
    })
    .input(offerCodeInputSchema)
    .output(offerLookupSchema)
    .handler(({ context, input }) => lookupCode(context, context.hotel.hotelId, input.code)),

  redeem: hotelProcedure
    .use(can({ offer: ["redeem"] }))
    .route({ method: "POST", path: "/offers/redeem", summary: "Mark a code redeemed, once", tags: ["offers"] })
    .input(offerCodeInputSchema)
    .output(offerLookupSchema)
    .handler(async ({ context, input }) => {
      const { redemptionId, ...result } = await redeemCode(context, context.hotel.hotelId, context.user.id, input.code)
      if (redemptionId) {
        await audit(context, {
          action: "offer.redeem",
          targetId: redemptionId,
          metadata: { offerId: result.offer?.id, hotelId: context.hotel.hotelId },
        })
      }
      return result
    }),

  redemptionStats: hotelProcedure
    .use(can({ offer: ["read"] }))
    .route({
      method: "GET",
      path: "/offers/redemptions",
      summary: "Redemption counts and the latest redemptions of the active hotel",
      tags: ["offers"],
    })
    .output(redemptionStatsSchema)
    .handler(async ({ context }) => {
      const { hotelId } = context.hotel
      const mine = eq(offerRedemptions.hotelId, hotelId)
      const startOfToday = sql`date_trunc('day', now() at time zone ${hotelSettings.timezone}) at time zone ${hotelSettings.timezone}`
      const [counts] = await context.db
        .select({
          total: count(),
          week: count(sql`case when ${offerRedemptions.redeemedAt} >= now() - interval '7 days' then 1 end`),
          today: count(sql`case when ${offerRedemptions.redeemedAt} >= ${startOfToday} then 1 end`),
        })
        .from(offerRedemptions)
        .innerJoin(hotelSettings, eq(hotelSettings.organizationId, offerRedemptions.hotelId))
        .where(mine)
      const recent = await context.db
        .select({
          id: offerRedemptions.id,
          offerTitle: offers.title,
          guestName: guests.name,
          redeemedAt: offerRedemptions.redeemedAt,
          redeemedBy: user.name,
        })
        .from(offerRedemptions)
        .innerJoin(offers, eq(offers.id, offerRedemptions.offerId))
        .leftJoin(guests, eq(guests.id, offerRedemptions.guestId))
        .leftJoin(user, eq(user.id, offerRedemptions.redeemedBy))
        .where(mine)
        .orderBy(desc(offerRedemptions.redeemedAt))
        .limit(10)
      return {
        today: counts?.today ?? 0,
        week: counts?.week ?? 0,
        total: counts?.total ?? 0,
        recent: recent.map(({ guestName, ...row }) => ({
          ...row,
          guestFirstName: guestName ? firstName(guestName) : null,
        })),
      }
    }),
}
