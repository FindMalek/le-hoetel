import { z } from "zod"
import { CONSENT_CHANNELS, CONSENT_SOURCES, GUEST_SOURCES } from "../consent"
import { HOTEL_LANGUAGES } from "../hotel"
import { isWhatsappCapable, parsePhone } from "../phone"

export const GUEST_LIST_MAX = 200

const name = z.string().trim().min(1).max(120)
const email = z
  .email()
  .max(200)
  .transform((value) => value.toLowerCase())
/** What a person types (`20 123 456`, `00216…`, `+33…`) in, a clean E.164 number out. */
export const phoneInputSchema = z
  .string()
  .max(40)
  .transform((value, ctx) => {
    const parsed = parsePhone(value)
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number, like 20 123 456 or +33 6 12 34 56 78." })
      return z.NEVER
    }
    return parsed.e164
  })
const day = z.iso.date()
const birthday = day.refine(
  (value) => value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10),
  "Pick a real birthday.",
)
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

export const guestFields = { name, email, birthday }

/** The optional-with-consent tier: only stored while the guest's `profile` consent is granted. */
export const GUEST_EXTRA_FIELDS = ["country", "city", "stayCheckIn", "stayCheckOut", "nextDestination"] as const

const extras = {
  country: z.string().trim().length(2).toUpperCase(),
  city: text(80),
  stayCheckIn: day,
  stayCheckOut: day,
  nextDestination: text(120),
}

export const guestConsentsSchema = z.object({ email: z.boolean(), whatsapp: z.boolean(), profile: z.boolean() })

export const guestSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phoneE164: z.string(),
  language: z.enum(HOTEL_LANGUAGES),
  email: z.string().nullable(),
  birthday: z.string().nullable(),
  source: z.enum(GUEST_SOURCES),
  country: z.string().nullable(),
  city: z.string().nullable(),
  stayCheckIn: z.string().nullable(),
  stayCheckOut: z.string().nullable(),
  nextDestination: z.string().nullable(),
  consents: guestConsentsSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

const hasExtras = (value: Partial<Record<(typeof GUEST_EXTRA_FIELDS)[number], unknown>>) =>
  GUEST_EXTRA_FIELDS.some((field) => value[field] != null)

export const guestCreateSchema = z
  .object({
    name,
    phone: phoneInputSchema,
    language: z.enum(HOTEL_LANGUAGES),
    email: email.nullish(),
    birthday: birthday.nullish(),
    source: z.enum(GUEST_SOURCES),
    captureLocation: text(40).nullish(),
    consents: guestConsentsSchema,
    country: extras.country.nullish(),
    city: extras.city.nullish(),
    stayCheckIn: extras.stayCheckIn.nullish(),
    stayCheckOut: extras.stayCheckOut.nullish(),
    nextDestination: extras.nextDestination.nullish(),
  })
  .refine((value) => !value.consents.email || !!value.email, {
    path: ["email"],
    message: "Email consent needs an email.",
  })
  .refine((value) => !value.consents.whatsapp || isWhatsappCapable(value.phone), {
    path: ["consents", "whatsapp"],
    message: "This number can't receive WhatsApp.",
  })
  .refine((value) => value.consents.profile || !hasExtras(value), {
    path: ["consents", "profile"],
    message: "Country, city and stay details need the guest's consent.",
  })

/** No defaults: a patch only touches the fields it carries. Consent changes go through `guests.setConsent`. */
export const guestUpdateSchema = z.object({
  id: z.uuid(),
  name: name.optional(),
  language: z.enum(HOTEL_LANGUAGES).optional(),
  email: email.nullable().optional(),
  birthday: birthday.nullable().optional(),
  country: extras.country.nullable().optional(),
  city: extras.city.nullable().optional(),
  stayCheckIn: extras.stayCheckIn.nullable().optional(),
  stayCheckOut: extras.stayCheckOut.nullable().optional(),
  nextDestination: extras.nextDestination.nullable().optional(),
})

export const guestListInputSchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.number().int().min(1).max(GUEST_LIST_MAX).default(50),
  offset: z.number().int().min(0).default(0),
})

export const guestUpsertResultSchema = guestSchema.extend({ merged: z.boolean() })

export const guestListSchema = z.object({ items: z.array(guestSchema), total: z.number() })

export const consentSetSchema = z.object({
  guestId: z.uuid(),
  channel: z.enum(CONSENT_CHANNELS),
  granted: z.boolean(),
  source: z.enum(CONSENT_SOURCES),
})

export const consentEventSchema = z.object({
  id: z.uuid(),
  channel: z.enum(CONSENT_CHANNELS),
  granted: z.boolean(),
  source: z.enum(CONSENT_SOURCES),
  wordingVersion: z.string(),
  at: z.date(),
})

export type Guest = z.infer<typeof guestSchema>

export const guestExportSchema = z.object({
  exportedAt: z.date(),
  guest: guestSchema,
  consentEvents: z.array(consentEventSchema),
})

export const hotelGuestsExportSchema = z.object({
  exportedAt: z.date(),
  guests: z.array(guestExportSchema.omit({ exportedAt: true })),
})
