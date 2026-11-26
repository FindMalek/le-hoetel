import { z } from "zod"
import { CONSENT_CHANNELS, CONSENT_SOURCES, GUEST_SOURCES } from "../consent"
import { FEEDBACK_CASE_STATUSES } from "../feedback-case"
import { HOTEL_LANGUAGES } from "../hotel"
import { isWhatsappCapable, parsePhone } from "../phone"
import { cursorSchema } from "./cursor"

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

export const guestRecognitionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phoneE164: z.string(),
  language: z.enum(HOTEL_LANGUAGES),
  consents: z.object({ email: z.boolean(), whatsapp: z.boolean() }),
  visits: z.number().int(),
  firstVisitAt: z.date().nullable(),
  lastVisitAt: z.date().nullable(),
  lastOffer: z.object({ title: z.string(), at: z.date() }).nullable(),
  /** On the hotel's clock. A guest is counted at most once per day. */
  visitedToday: z.boolean(),
})

/** `visitId` is the visit this call recorded, null when today was already counted. */
export const guestVisitResultSchema = guestRecognitionSchema.extend({ visitId: z.uuid().nullable() })

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

/** `none` is a guest we may not message: neither email nor WhatsApp consent. */
export const GUEST_CONSENT_FILTERS = [...CONSENT_CHANNELS, "none"] as const

export const guestListInputSchema = z.object({
  q: z.string().trim().max(80).optional(),
  consent: z.enum(GUEST_CONSENT_FILTERS).optional(),
  source: z.enum(GUEST_SOURCES).optional(),
  language: z.enum(HOTEL_LANGUAGES).optional(),
  /** Guests with at least two recorded visits. */
  returning: z.boolean().optional(),
  limit: z.number().int().min(1).max(GUEST_LIST_MAX).default(50),
  cursor: cursorSchema.optional(),
})

/** What a merge into a known phone can touch. */
export const GUEST_MERGE_FIELDS = [
  "name",
  "language",
  "email",
  "birthday",
  "country",
  "city",
  "stayCheckIn",
  "stayCheckOut",
  "nextDestination",
] as const

const mergeFields = z.array(z.enum([...GUEST_MERGE_FIELDS, "emailConsent", "whatsappConsent", "profileConsent"]))

export const guestUpsertResultSchema = guestSchema.extend({
  merged: z.boolean(),
  /** Empty for a new guest. */
  changed: mergeFields,
  /** Typed values that were not saved because the record already had another one. */
  kept: mergeFields,
  /** False when today was already counted. */
  visitRecorded: z.boolean(),
})
export type GuestUpsertResult = z.infer<typeof guestUpsertResultSchema>

export const guestListSchema = z.object({
  items: z.array(guestSchema.extend({ visits: z.number().int() })),
  total: z.number(),
  nextCursor: z.string().nullable(),
})

/** What happened with one guest at the hotel, newest first: stays, offers used and survey answers. */
export const guestActivitySchema = z.object({
  stays: z.array(z.object({ id: z.uuid(), source: z.enum(GUEST_SOURCES), at: z.date() })),
  offers: z.array(z.object({ id: z.uuid(), title: z.string(), at: z.date() })),
  surveys: z.array(
    z.object({
      id: z.uuid(),
      nps: z.number().int(),
      ratingRooms: z.number().int().nullable(),
      ratingCleanliness: z.number().int().nullable(),
      ratingService: z.number().int().nullable(),
      comment: z.string().nullable(),
      at: z.date(),
    }),
  ),
})

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

export const GUEST_IMPORT_MAX_ROWS = 1000
export const GUEST_IMPORT_MAX_BYTES = 1_000_000

const cell = (max: number) => z.string().max(max).optional()

/** One csv row after column mapping: raw text, checked and normalised per row by the server. */
export const guestImportRowSchema = z.object({
  line: z.number().int().min(1),
  name: cell(200),
  phone: cell(60),
  email: cell(200),
  birthday: cell(20),
  language: cell(20),
  consent: cell(20),
})

export const guestImportInputSchema = z.object({
  rows: z.array(guestImportRowSchema).min(1).max(GUEST_IMPORT_MAX_ROWS),
  defaultLanguage: z.enum(HOTEL_LANGUAGES),
  /** The hotel says it holds the consent of every guest whose consent cell is true. Without it nobody gets consent. */
  confirmConsent: z.boolean(),
})

export const guestImportResultSchema = z.object({
  created: z.number(),
  merged: z.number(),
  /** Rows whose consent "yes" was ignored because the guest had withdrawn that channel. */
  consentKept: z.number(),
  errors: z.array(z.object({ line: z.number(), message: z.string() })),
})

export type GuestImportRow = z.infer<typeof guestImportRowSchema>
export type GuestImportResult = z.infer<typeof guestImportResultSchema>

const EXPLICIT_YES = new Set(["true", "yes", "oui", "1", "y", "نعم"])
const blank = (value?: string) => value?.trim() || null

/** `31/12/1990` (what spreadsheets export) becomes `1990-12-31`, anything else is left for the schema to judge. */
const isoDay = (value: string | null) => {
  const match = value?.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  return match ? `${match[3]}-${match[2]?.padStart(2, "0")}-${match[1]?.padStart(2, "0")}` : value
}

/**
 * The input `guestCreateSchema` checks for one csv row. Consent is only granted by an explicit yes in the consent
 * cell and only when the hotel confirmed it holds it: a blank or unclear cell is no consent. It covers each
 * channel the row can use, WhatsApp for a number that takes it and email when there is an address.
 */
export function guestFromImportRow(row: GuestImportRow, options: Omit<z.infer<typeof guestImportInputSchema>, "rows">) {
  const email = blank(row.email)
  const phone = row.phone ?? ""
  const yes = options.confirmConsent && EXPLICIT_YES.has((row.consent ?? "").trim().toLowerCase())
  const parsed = parsePhone(phone)
  return {
    name: row.name ?? "",
    phone,
    email,
    birthday: isoDay(blank(row.birthday)),
    language: blank(row.language)?.toLowerCase() ?? options.defaultLanguage,
    source: "csv",
    consents: { email: yes && !!email, whatsapp: yes && !!parsed?.whatsappCapable, profile: false },
  }
}

export type Guest = z.infer<typeof guestSchema>
export type GuestListItem = z.infer<typeof guestListSchema>["items"][number]
export type GuestActivity = z.infer<typeof guestActivitySchema>

/** What the hotel wrote down while following up an unhappy answer. */
export const exportedFeedbackSchema = z.object({
  status: z.enum(FEEDBACK_CASE_STATUSES),
  notes: z.string().nullable(),
  nps: z.number(),
  comment: z.string().nullable(),
  submittedAt: z.date(),
  updatedAt: z.date(),
})

export const exportedWhatsappScanSchema = z.object({
  phoneE164: z.string(),
  source: z.string(),
  location: z.string().nullable(),
  language: z.string(),
  lastScanAt: z.date(),
  repliedAt: z.date(),
})

export const guestExportSchema = z.object({
  exportedAt: z.date(),
  guest: guestSchema,
  consentEvents: z.array(consentEventSchema),
  feedback: z.array(exportedFeedbackSchema),
  whatsappScans: z.array(exportedWhatsappScanSchema),
})

export const hotelGuestsExportSchema = z.object({
  exportedAt: z.date(),
  guests: z.array(guestExportSchema.omit({ exportedAt: true, whatsappScans: true })),
  whatsappScans: z.array(exportedWhatsappScanSchema),
})
