import { z } from "zod"
import type { GuestSource } from "../consent"
import { HOTEL_LANGUAGES } from "../hotel"
import { guestFields, phoneInputSchema } from "./guest"

/** The `src` of a QR code url, mapped to the guest source it is stored under. */
export const CAPTURE_SOURCES = { room: "qr_room", table: "qr_table", desk: "qr_front_desk" } as const satisfies Record<
  string,
  GuestSource
>
export type CaptureSource = keyof typeof CAPTURE_SOURCES
export const CAPTURE_LOCATION_MAX = 40

/** A person needs longer than this to type a name and a phone number. */
export const CAPTURE_MIN_FILL_MS = 3000

/** The only hotel fields a visitor without a session can read. */
export const publicHotelSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  defaultLanguage: z.enum(HOTEL_LANGUAGES),
  logoUrl: z.string().nullable(),
})
export type PublicHotel = z.infer<typeof publicHotelSchema>

export const captureInputSchema = z.object({
  slug: z.string().min(1).max(100),
  name: guestFields.name,
  phone: phoneInputSchema,
  language: z.enum(HOTEL_LANGUAGES),
  email: guestFields.email.nullish(),
  birthday: guestFields.birthday.nullish(),
  source: z.enum(Object.keys(CAPTURE_SOURCES) as [CaptureSource, ...CaptureSource[]]),
  location: z.string().trim().max(CAPTURE_LOCATION_MAX).nullish(),
  consents: z.object({ email: z.boolean(), whatsapp: z.boolean() }),
  /** Hidden field no person fills: any value means a bot. */
  website: z.string().max(200).nullish(),
  /** When the page was rendered (ms since epoch), to refuse forms sent faster than a person can type. */
  renderedAt: z.number().int(),
})
export type CaptureInput = z.input<typeof captureInputSchema>
