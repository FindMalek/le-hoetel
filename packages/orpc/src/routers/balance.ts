import { LOW_BALANCE_MILLIMES } from "@le-hoetel/common/pricing"
import { organization } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { getBalance, recentLedger, topUp, usageSince } from "../lib/balance"
import { adminProcedure, can, hotelProcedure } from "../procedures"

const balanceSchema = z.object({
  balanceMillimes: z.number().int(),
  low: z.boolean(),
  monthSpentMillimes: z.number().int(),
  monthMessages: z.number().int(),
  entries: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["top_up", "usage", "refund"]),
      amountMillimes: z.number().int(),
      note: z.string().nullable(),
      createdAt: z.date(),
    }),
  ),
})

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function loadBalance(context: Pick<Context, "db" | "now">, hotelId: string) {
  const [balanceMillimes, month, entries] = await Promise.all([
    getBalance(context.db, hotelId),
    usageSince(context.db, hotelId, startOfMonth(context.now())),
    recentLedger(context.db, hotelId),
  ])
  return {
    balanceMillimes,
    low: balanceMillimes < LOW_BALANCE_MILLIMES,
    monthSpentMillimes: month.spentMillimes,
    monthMessages: month.messages,
    entries,
  }
}

export const balanceRouter = {
  get: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({
      method: "GET",
      path: "/hotel/balance",
      summary: "Prepaid WhatsApp balance, this month's usage and the latest ledger entries",
      tags: ["hotel"],
    })
    .output(balanceSchema)
    .handler(({ context }) => loadBalance(context, context.hotel.hotelId)),
}

export const adminBalanceRouter = {
  get: adminProcedure
    .route({ method: "GET", path: "/admin/hotels/balance", summary: "A hotel's prepaid balance", tags: ["admin"] })
    .input(z.object({ id: z.string() }))
    .output(balanceSchema)
    .handler(({ context, input }) => loadBalance(context, input.id)),

  topUp: adminProcedure
    .route({
      method: "POST",
      path: "/admin/hotels/balance/top-up",
      summary: "Add prepaid credit to a hotel (TND millimes)",
      tags: ["admin"],
    })
    .input(
      z.object({
        id: z.string(),
        amountMillimes: z.number().int().min(1000).max(10_000_000),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .output(z.object({ balanceMillimes: z.number().int() }))
    .handler(async ({ context, input }) => {
      const [hotel] = await context.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, input.id))
      if (!hotel) throw new ORPCError("NOT_FOUND", { message: "Hotel not found." })
      const balanceMillimes = await topUp(context.db, input.id, input.amountMillimes, {
        createdBy: context.session?.user.id,
        note: input.note || null,
      })
      await audit(context, {
        action: "hotel.balance.top_up",
        targetId: input.id,
        metadata: { amountMillimes: input.amountMillimes },
      })
      return { balanceMillimes }
    }),
}
