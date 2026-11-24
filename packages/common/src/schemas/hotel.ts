import { z } from "zod"
import { HOTEL_HEALTHS, HOTEL_LANGUAGES, HOTEL_PLANS, HOTEL_STATUSES } from "../hotel"

const text = (max: number) => z.string().trim().min(1).max(max)
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1a2b3c.")
  .nullable()

const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })
    return true
  } catch {
    return false
  }
}, "Unknown timezone.")

const httpsUrl = z
  .url()
  .max(500)
  .refine((value) => value.startsWith("https://"), "Use an https link.")
  .nullable()

export const hotelBrandingInputSchema = z.object({
  displayName: text(80),
  logoKey: nullableText(300),
  primaryColor: hexColor,
  accentColor: hexColor,
  replyToEmail: z.email().max(200).nullable(),
  defaultLanguage: z.enum(HOTEL_LANGUAGES),
  timezone,
  googleReviewUrl: httpsUrl,
  managerWhatsapp: nullableText(40),
  managerTelegram: nullableText(80),
})

export const hotelUpdateSchema = hotelBrandingInputSchema.partial()

export const hotelAdminUpdateSchema = hotelUpdateSchema.extend({
  plan: z.enum(HOTEL_PLANS).optional(),
  status: z.enum(HOTEL_STATUSES).optional(),
  pilotEndsAt: z.date().nullable().optional(),
})

export const hotelSchema = hotelBrandingInputSchema.extend({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(HOTEL_PLANS),
  status: z.enum(HOTEL_STATUSES),
  pilotEndsAt: z.date().nullable(),
  createdAt: z.date(),
})

export const hotelCreateSchema = z.object({
  name: text(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, digits and dashes.")
    .max(60),
  ownerEmail: z.email(),
  displayName: text(80).optional(),
  primaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  defaultLanguage: z.enum(HOTEL_LANGUAGES).optional(),
})

export const adminHotelSchema = hotelSchema.extend({
  guestCount: z.number().int(),
  ownerCount: z.number().int(),
  lastGuestAt: z.date().nullable(),
  health: z.enum(HOTEL_HEALTHS),
})

export type Hotel = z.infer<typeof hotelSchema>
