import { ORPCError } from "@orpc/server"
import { invoicesToCsv } from "@ritorno/common/billing"
import { ADMIN_LIST_LIMIT } from "@ritorno/common/constants"
import { HOTEL_PLANS, type HotelPlan } from "@ritorno/common/hotel"
import { billingPlanSchema, billingPlanUpdateSchema, invoiceCreateSchema, invoiceSchema } from "@ritorno/common/schemas"
import { billingPlans, hotelSettings, invoices } from "@ritorno/db"
import { and, desc, eq, ne } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { adminProcedure } from "../procedures"

async function loadPlans(db: Context["db"]) {
  const rows = await db.select().from(billingPlans)
  return HOTEL_PLANS.map((plan) => {
    const row = rows.find((item) => item.plan === plan)
    return { plan, name: row?.name ?? null, monthlyMillimes: row?.monthlyMillimes ?? null }
  })
}

const defaultPlanName = (plan: HotelPlan) => plan.charAt(0).toUpperCase() + plan.slice(1)

const selectInvoices = (db: Context["db"], hotelId: string | undefined) =>
  db
    .select()
    .from(invoices)
    .where(hotelId ? eq(invoices.hotelId, hotelId) : undefined)
    .orderBy(desc(invoices.number))

const hotelFilter = z.object({ hotelId: z.string().optional() }).default({})

export const adminBillingRouter = {
  plans: adminProcedure
    .route({ method: "GET", path: "/admin/billing/plans", summary: "Plan names and monthly prices", tags: ["admin"] })
    .output(z.array(billingPlanSchema))
    .handler(({ context }) => loadPlans(context.db)),

  updatePlan: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/billing/plans",
      summary: "Set a plan's name and monthly price (TND millimes)",
      tags: ["admin"],
    })
    .input(billingPlanUpdateSchema)
    .output(z.array(billingPlanSchema))
    .handler(async ({ context, input: { plan, ...values } }) => {
      await context.db
        .insert(billingPlans)
        .values({ plan, ...values })
        .onConflictDoUpdate({ target: billingPlans.plan, set: { ...values, updatedAt: context.now() } })
      await audit(context, { action: "billing.plan-update", targetId: plan, metadata: values })
      return loadPlans(context.db)
    }),

  invoices: adminProcedure
    .route({
      method: "GET",
      path: "/admin/billing/invoices",
      summary: "The latest invoices, of one hotel or all",
      tags: ["admin"],
    })
    .input(hotelFilter)
    .output(z.array(invoiceSchema))
    .handler(({ context, input }) => selectInvoices(context.db, input.hotelId).limit(ADMIN_LIST_LIMIT)),

  createInvoice: adminProcedure
    .route({
      method: "POST",
      path: "/admin/billing/invoices",
      summary: "Record one month's invoice for a hotel",
      tags: ["admin"],
    })
    .input(invoiceCreateSchema)
    .output(invoiceSchema)
    .handler(async ({ context, input }) => {
      const [hotel] = await context.db
        .select({ name: hotelSettings.displayName, plan: hotelSettings.plan })
        .from(hotelSettings)
        .where(eq(hotelSettings.organizationId, input.hotelId))
      if (!hotel) throw new ORPCError("NOT_FOUND", { message: "Hotel not found." })
      const plan = (await loadPlans(context.db)).find((item) => item.plan === hotel.plan)
      const amountMillimes = input.amountMillimes ?? plan?.monthlyMillimes
      if (!amountMillimes) {
        throw new ORPCError("UNPROCESSABLE_CONTENT", { message: "Enter an amount or set the plan's price first." })
      }
      const [invoice] = await context.db
        .insert(invoices)
        .values({
          hotelId: input.hotelId,
          hotelName: hotel.name,
          month: input.month,
          planName: plan?.name ?? defaultPlanName(hotel.plan),
          amountMillimes,
          note: input.note || null,
          createdBy: context.user.id,
        })
        .onConflictDoNothing()
        .returning()
      if (!invoice) {
        throw new ORPCError("CONFLICT", { message: "This hotel already has an invoice for that month. Void it first." })
      }
      await audit(context, {
        action: "billing.invoice-create",
        targetId: invoice.id,
        metadata: { hotelId: input.hotelId, number: invoice.number, month: input.month, amountMillimes },
      })
      return invoice
    }),

  setInvoiceStatus: adminProcedure
    .route({
      method: "PATCH",
      path: "/admin/billing/invoices/{id}",
      summary: "Mark an invoice paid, unpaid or void",
      tags: ["admin"],
    })
    .input(z.object({ id: z.uuid(), status: invoiceSchema.shape.status }))
    .output(invoiceSchema)
    .handler(async ({ context, input }) => {
      const [invoice] = await context.db
        .update(invoices)
        .set({ status: input.status, paidAt: input.status === "paid" ? context.now() : null })
        .where(and(eq(invoices.id, input.id), ne(invoices.status, "void"), ne(invoices.status, input.status)))
        .returning()
      if (!invoice) {
        const [current] = await context.db.select().from(invoices).where(eq(invoices.id, input.id))
        if (!current) throw new ORPCError("NOT_FOUND", { message: "Invoice not found." })
        if (current.status === input.status) return current
        throw new ORPCError("CONFLICT", { message: "A void invoice can't change. Create a new one." })
      }
      await audit(context, {
        action: "billing.invoice-status",
        targetId: invoice.id,
        metadata: { hotelId: invoice.hotelId, number: invoice.number, status: invoice.status },
      })
      return invoice
    }),

  exportInvoices: adminProcedure
    .route({
      method: "POST",
      path: "/admin/billing/invoices/export",
      summary: "Every invoice, of one hotel or all, as CSV",
      tags: ["admin"],
    })
    .input(hotelFilter)
    .output(z.object({ csv: z.string(), count: z.number().int() }))
    .handler(async ({ context, input }) => {
      const rows = await selectInvoices(context.db, input.hotelId)
      await audit(context, {
        action: "billing.export",
        targetId: input.hotelId,
        metadata: { count: rows.length },
      })
      return { csv: invoicesToCsv(rows), count: rows.length }
    }),
}
