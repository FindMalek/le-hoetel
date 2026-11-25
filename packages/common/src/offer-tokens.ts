import { createHmac, randomInt, timingSafeEqual } from "node:crypto"
import type { HotelLanguage } from "./hotel"

/** No 0/O or 1/I/L: a code read off a phone screen and typed at a front desk. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 8

/** A guest's redemption code, shown `ABCD-EFGH`. About 10^11 values, and the unique column catches a collision. */
export function newGuestCode(): string {
  const raw = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

const VERSION = "v1"

export interface OfferSubject {
  hotelId: string
  offerId: string
  guestId: string
}

const sign = (secret: string, payload: string): Buffer => {
  const key = createHmac("sha256", secret).update("le-hoetel:offer:v1").digest()
  return createHmac("sha256", key).update(payload).digest()
}

/** The link a guest gets for one offer: not guessable, not forgeable, stateless. */
export function signOfferToken(secret: string, subject: OfferSubject): string {
  const payload = [VERSION, subject.hotelId, subject.offerId, subject.guestId].join("|")
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(secret, payload).toString("base64url")}`
}

export function verifyOfferToken(secret: string, token: string): OfferSubject | null {
  const [body, signature, ...extra] = token.split(".")
  if (!body || !signature || extra.length) return null
  const payload = Buffer.from(body, "base64url").toString("utf8")
  const given = Buffer.from(signature, "base64url")
  const expected = sign(secret, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const [version, hotelId, offerId, guestId, ...rest] = payload.split("|")
  if (version !== VERSION || !hotelId || !offerId || !guestId || rest.length) return null
  return { hotelId, offerId, guestId }
}

/** The page a guest opens to show the offer, in their language (English has no prefix, like the rest of the site). */
export function offerPageUrl(webUrl: string, token: string, language: HotelLanguage): string {
  const prefix = language === "en" ? "" : `/${language}`
  return `${webUrl.replace(/\/$/, "")}${prefix}/o/${token}`
}
