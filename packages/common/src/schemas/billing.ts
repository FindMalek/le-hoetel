import { z } from "zod"
import { BILLING_AMOUNT_MAX_MILLIMES, INVOICE_STATUSES } from "../billing"
import { HOTEL_PLANS } from "../hotel"

const amount = z.number().int().min(0).max(BILLING_AMOUNT_MAX_MILLIMES)

/** A plan nobody configured yet has no name and no price: we never ship a price of our own. */
export const billingPlanSchema = z.object({
  plan: z.enum(HOTEL_PLANS),
  name: z.string().nullable(),
  monthlyMillimes: z.number().int().nullable(),
})

export const billingPlanUpdateSchema = z.object({
  plan: z.enum(HOTEL_PLANS),
  name: z
    .string()
    .trim()
    .max(40)
    .transform((value) => value || null)
    .nullable(),
  monthlyMillimes: amount.nullable(),
})

export const invoiceSchema = z.object({
  id: z.uuid(),
  number: z.number().int(),
  hotelId: z.string(),
  hotelName: z.string(),
  month: z.string(),
  planName: z.string(),
  amountMillimes: z.number().int(),
  status: z.enum(INVOICE_STATUSES),
  note: z.string().nullable(),
  paidAt: z.date().nullable(),
  createdAt: z.date(),
})

export const invoiceCreateSchema = z.object({
  hotelId: z.string(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month like 2026-11."),
  /** Left out: the price of the hotel's plan. */
  amountMillimes: amount.min(1).optional(),
  note: z.string().trim().max(200).optional(),
})

export type BillingPlan = z.infer<typeof billingPlanSchema>
export type Invoice = z.infer<typeof invoiceSchema>
