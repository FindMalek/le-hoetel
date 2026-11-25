export const OFFER_TRIGGERS = ["welcome", "birthday", "manual"] as const
export type OfferTrigger = (typeof OFFER_TRIGGERS)[number]

export interface OfferWindow {
  active: boolean
  validFrom: Date
  validUntil: Date | null
  maxRedemptions: number | null
}

export type OfferState = "ready" | "inactive" | "notStarted" | "expired" | "exhausted"

/** Whether an offer can be redeemed now. Order matters: the most useful reason for the staff comes first. */
export function offerState(offer: OfferWindow, redeemed: number, now: Date): OfferState {
  if (!offer.active) return "inactive"
  if (offer.validFrom > now) return "notStarted"
  if (offer.validUntil && offer.validUntil < now) return "expired"
  if (offer.maxRedemptions !== null && redeemed >= offer.maxRedemptions) return "exhausted"
  return "ready"
}

export const PROMO_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,23}$/

/** What a scanner or a keyboard produced, made comparable: no spaces, upper case. */
export const normalizeCode = (input: string): string => input.replace(/\s+/g, "").toUpperCase()
