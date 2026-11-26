import { z } from "zod"
import { HOTEL_LANGUAGES } from "../hotel"
import { OFFER_TRIGGERS, PROMO_CODE_PATTERN } from "../offers"
import { cursorSchema } from "./cursor"

export const OFFER_TITLE_MAX = 80
export const OFFER_TEXT_MAX = 400

const fields = {
  title: z.string().trim().min(1).max(OFFER_TITLE_MAX),
  text: z.string().trim().max(OFFER_TEXT_MAX),
  promoCode: z.string().trim().toUpperCase().regex(PROMO_CODE_PATTERN, "3 to 24 letters, numbers or dashes"),
  trigger: z.enum(OFFER_TRIGGERS).nullable(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().nullable(),
  maxRedemptions: z.number().int().min(1).max(100000).nullable(),
  active: z.boolean(),
}

const windowIsOrdered = (offer: { validFrom?: Date; validUntil?: Date | null }) =>
  !offer.validFrom || !offer.validUntil || offer.validUntil > offer.validFrom

export const offerCreateSchema = z
  .object({
    ...fields,
    text: fields.text.default(""),
    trigger: fields.trigger.default(null),
    validFrom: fields.validFrom.optional(),
    validUntil: fields.validUntil.default(null),
    maxRedemptions: fields.maxRedemptions.default(null),
    active: fields.active.default(true),
  })
  .refine(windowIsOrdered, { message: "The end must be after the start.", path: ["validUntil"] })

export const offerUpdateSchema = z
  .object({
    id: z.uuid(),
    title: fields.title.optional(),
    text: fields.text.optional(),
    promoCode: fields.promoCode.optional(),
    trigger: fields.trigger.optional(),
    validFrom: fields.validFrom.optional(),
    validUntil: fields.validUntil.optional(),
    maxRedemptions: fields.maxRedemptions.optional(),
    active: fields.active.optional(),
  })
  .refine(windowIsOrdered, { message: "The end must be after the start.", path: ["validUntil"] })

export const offerSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  promoCode: z.string(),
  trigger: z.enum(OFFER_TRIGGERS).nullable(),
  validFrom: z.date(),
  validUntil: z.date().nullable(),
  maxRedemptions: z.number().nullable(),
  active: z.boolean(),
  redeemed: z.number(),
  createdAt: z.date(),
})
export type Offer = z.infer<typeof offerSchema>

/** What a guest with the link sees: the hotel's look, the offer and the code to show. Never anything about the guest. */
export const offerPageSchema = z.object({
  hotel: z.object({
    displayName: z.string(),
    logoUrl: z.string().nullable(),
    primaryColor: z.string().nullable(),
    accentColor: z.string().nullable(),
  }),
  language: z.enum(HOTEL_LANGUAGES),
  offer: z.object({
    title: z.string(),
    text: z.string(),
    validFrom: z.date(),
    validUntil: z.date().nullable(),
  }),
  state: z.enum(["ready", "inactive", "notStarted", "expired", "exhausted", "redeemed"]),
  code: z.string(),
  qrSvg: z.string(),
})

/** The perk shown on the public capture page: the hotel's active welcome offer, title and text only. */
export const welcomeOfferSchema = z.object({ title: z.string(), text: z.string() })

export const OFFER_CODE_MAX = 64
export const offerCodeInputSchema = z.object({ code: z.string().trim().min(1).max(OFFER_CODE_MAX) })

export const REDEEM_STATUSES = [
  "ready",
  "redeemed",
  "expired",
  "notStarted",
  "inactive",
  "exhausted",
  "wrongHotel",
  "unknown",
] as const

/** What the staff see after a scan: the offer, the guest's first name only and why a code can or cannot be redeemed. */
export const offerLookupSchema = z.object({
  status: z.enum(REDEEM_STATUSES),
  offer: z
    .object({
      id: z.string(),
      title: z.string(),
      text: z.string(),
      validFrom: z.date(),
      validUntil: z.date().nullable(),
    })
    .nullable(),
  guestFirstName: z.string().nullable(),
  redeemed: z.object({ at: z.date(), by: z.string().nullable() }).nullable(),
  /** True only for the call that made the redemption, so a retry after a lost answer reads as already redeemed. */
  justNow: z.boolean(),
})
export type OfferLookup = z.infer<typeof offerLookupSchema>

export const redemptionStatsSchema = z.object({
  today: z.number(),
  week: z.number(),
  total: z.number(),
})

export const redemptionListInputSchema = z
  .object({ limit: z.number().int().min(1).max(100).default(20), cursor: cursorSchema.optional() })
  .prefault({})

export const redemptionListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      offerTitle: z.string(),
      guestFirstName: z.string().nullable(),
      redeemedAt: z.date(),
      redeemedBy: z.string().nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
})
