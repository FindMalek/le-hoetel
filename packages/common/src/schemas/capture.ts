import { z } from "zod"
import type { GuestSource } from "../consent"
import { HOTEL_LANGUAGES } from "../hotel"
import { guestFields, phoneInputSchema } from "./guest"
import { welcomeOfferSchema } from "./offers"

/** The `src` of a QR code url, mapped to the guest source it is stored under. */
export const CAPTURE_SOURCES = { room: "qr_room", table: "qr_table", desk: "qr_front_desk" } as const satisfies Record<
  string,
  GuestSource
>
export type CaptureSource = keyof typeof CAPTURE_SOURCES
export const CAPTURE_LOCATION_MAX = 40

/** The only hotel fields a visitor without a session can read. */
export const publicHotelSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  defaultLanguage: z.enum(HOTEL_LANGUAGES),
  logoUrl: z.string().nullable(),
  welcomeOffer: welcomeOfferSchema.nullable(),
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
})
export type CaptureInput = z.input<typeof captureInputSchema>

export const qrCodesInputSchema = z.object({
  source: z.enum(Object.keys(CAPTURE_SOURCES) as [CaptureSource, ...CaptureSource[]]),
  spots: z.array(z.string().trim().min(1).max(CAPTURE_LOCATION_MAX)).max(100),
})

export const qrCodeSchema = z.object({ location: z.string().nullable(), url: z.string(), svg: z.string() })

/** The places a hotel keeps a list of: each room and table has its own code. The front desk needs none. */
export const SPOT_SOURCES = ["room", "table"] as const satisfies readonly CaptureSource[]
export type SpotSource = (typeof SPOT_SOURCES)[number]

export const spotSchema = z.object({
  source: z.enum(SPOT_SOURCES),
  name: z.string().trim().min(1).max(CAPTURE_LOCATION_MAX),
})
export type Spot = z.infer<typeof spotSchema>

export const spotsAddInputSchema = z.object({
  source: z.enum(SPOT_SOURCES),
  /** A comma would split a name apart again in the print url. */
  names: z
    .array(spotSchema.shape.name.regex(/^[^,]*$/))
    .min(1)
    .max(100),
})

export const captureStatSchema = z.object({
  source: z.enum(Object.values(CAPTURE_SOURCES) as [GuestSource, ...GuestSource[]]),
  location: z.string().nullable(),
  guests: z.number(),
})
