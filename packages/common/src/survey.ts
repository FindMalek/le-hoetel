import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { TOKEN_NAMESPACE } from "./constants"

export const SURVEY_INVITE_DAYS = 14
export const SURVEY_HOURS_AFTER_STAY = 24
/** Longer than a week's stay, so a guest with no known check-out is not asked while still there. */
export const SURVEY_DAYS_WITHOUT_CHECKOUT = 8
export const DEFAULT_LOW_SCORE_THRESHOLD = 6
export const SURVEY_COMMENT_MAX = 1000

export const SURVEY_RATINGS = ["rooms", "cleanliness", "service"] as const

export const surveyAnswerSchema = z.object({
  nps: z.number().int().min(0).max(10),
  rooms: z.number().int().min(1).max(5).optional(),
  cleanliness: z.number().int().min(1).max(5).optional(),
  service: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(SURVEY_COMMENT_MAX).optional(),
})
export type SurveyAnswer = z.infer<typeof surveyAnswerSchema>

export type SurveyTokenPurpose = "survey" | "review"

export interface SurveySubject {
  hotelId: string
  inviteId: string
}

const sign = (secret: string, payload: string): Buffer => {
  const key = createHmac("sha256", secret).update(`${TOKEN_NAMESPACE}:survey:v1`).digest()
  return createHmac("sha256", key).update(payload).digest()
}

/** A link for one invite. `survey` opens the page, `review` is the click-tracking redirect to the hotel's Google page; the two never open each other. */
export function signSurveyToken(secret: string, purpose: SurveyTokenPurpose, subject: SurveySubject): string {
  const payload = ["v1", purpose, subject.hotelId, subject.inviteId].join("|")
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(secret, payload).toString("base64url")}`
}

export function verifySurveyToken(secret: string, purpose: SurveyTokenPurpose, token: string): SurveySubject | null {
  const [body, signature, ...extra] = token.split(".")
  if (!body || !signature || extra.length) return null
  const payload = Buffer.from(body, "base64url").toString("utf8")
  const given = Buffer.from(signature, "base64url")
  const expected = sign(secret, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const [version, kind, hotelId, inviteId, ...rest] = payload.split("|")
  if (version !== "v1" || kind !== purpose || !hotelId || !inviteId || rest.length) return null
  return { hotelId, inviteId }
}

export const surveyPageUrl = (webUrl: string, token: string): string => `${webUrl.replace(/\/$/, "")}/s/${token}`
export const reviewRedirectUrl = (webUrl: string, token: string): string => `${webUrl.replace(/\/$/, "")}/r/${token}`
