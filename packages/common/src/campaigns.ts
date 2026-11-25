import { z } from "zod"
import { GUEST_SOURCES } from "./consent"
import { HOTEL_LANGUAGES } from "./hotel"

export const CAMPAIGN_CHANNELS = ["both", "email", "whatsapp"] as const
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number]

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent", "cancelled"] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const CAMPAIGN_NAME_MAX = 80
export const CAMPAIGN_SUBJECT_MAX = 120
export const CAMPAIGN_BODY_MAX = 2000

/** Who gets it. Every list and window is optional: empty means everyone. Consent is not a filter, it is always required. */
export const campaignSegmentSchema = z.object({
  languages: z.array(z.enum(HOTEL_LANGUAGES)).max(3),
  countries: z.array(z.string().trim().min(1).max(60)).max(30),
  sources: z.array(z.enum(GUEST_SOURCES)).max(GUEST_SOURCES.length),
  /** Guests whose stay ended in the last N days. */
  lastVisitDays: z.number().int().min(1).max(3650).nullable(),
})
export type CampaignSegment = z.infer<typeof campaignSegmentSchema>

export const EMPTY_SEGMENT: CampaignSegment = { languages: [], countries: [], sources: [], lastVisitDays: null }

const textSchema = z.object({
  subject: z.string().trim().min(1).max(CAMPAIGN_SUBJECT_MAX),
  body: z.string().trim().min(1).max(CAMPAIGN_BODY_MAX),
})

/** The message per language. A guest gets their own language, else the hotel's, else the first one written. */
export const campaignContentSchema = z
  .object({ en: textSchema.optional(), fr: textSchema.optional(), ar: textSchema.optional() })
  .refine(
    (content) => HOTEL_LANGUAGES.some((language) => content[language]),
    "Write the message in at least one language.",
  )
export type CampaignContent = z.infer<typeof campaignContentSchema>

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(CAMPAIGN_NAME_MAX),
  channel: z.enum(CAMPAIGN_CHANNELS),
  content: campaignContentSchema,
  segment: campaignSegmentSchema,
  offerId: z.uuid().nullable(),
})
export type CampaignInput = z.infer<typeof campaignInputSchema>

export const campaignResultsSchema = z.object({
  /** Guests and channels the campaign reached out to so far. */
  targeted: z.number(),
  sent: z.number(),
  delivered: z.number(),
  failed: z.number(),
  skipped: z.number(),
})
export type CampaignResults = z.infer<typeof campaignResultsSchema>

export const campaignSchema = campaignInputSchema.extend({
  id: z.uuid(),
  status: z.enum(CAMPAIGN_STATUSES),
  scheduledAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  results: campaignResultsSchema,
})
export type Campaign = z.infer<typeof campaignSchema>

/** The text a guest reads: their language, else the hotel's, else the first language written. */
export function pickContent(content: CampaignContent, guestLanguage: string, hotelLanguage: string) {
  const byLanguage = content as Record<string, CampaignContent["en"]>
  return byLanguage[guestLanguage] ?? byLanguage[hotelLanguage] ?? HOTEL_LANGUAGES.map((l) => content[l]).find(Boolean)!
}
