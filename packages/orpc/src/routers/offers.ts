import { offerCreateSchema, offerSchema, offerUpdateSchema } from "@le-hoetel/common/schemas"
import { offers } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, getTableColumns, sql } from "drizzle-orm"
import { z } from "zod"
import { audit } from "../lib/audit"
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
}
