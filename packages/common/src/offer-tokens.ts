import { createHmac, randomInt, timingSafeEqual } from "node:crypto"
import { TOKEN_NAMESPACE } from "./constants"
import { HOTEL_LANGUAGES, type HotelLanguage } from "./hotel"

/** No 0/O or 1/I/L: a code read off a phone screen and typed at a front desk. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 8

const guestCodeFrom = (index: (position: number) => number): string => {
  const raw = Array.from({ length: CODE_LENGTH }, (_, position) => CODE_ALPHABET[index(position)]).join("")
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

/** A guest's redemption code, shown `ABCD-EFGH`. About 10^11 values, and the unique column catches a collision. */
export const newGuestCode = (): string => guestCodeFrom(() => randomInt(CODE_ALPHABET.length))

/**
 * The code one public sign-up is shown: the same inputs give the same code, so a retried submit reads the same, and
 * without the secret it cannot be told apart from `newGuestCode`.
 */
export function signUpCode(secret: string, parts: string[]): string {
  const digest = createHmac("sha256", secret)
    .update(`${TOKEN_NAMESPACE}:signup-code:v1`)
    .update(JSON.stringify(parts))
    .digest()
  return guestCodeFrom((position) => digest[position]! % CODE_ALPHABET.length)
}

const VERSION = "v1"

export interface OfferSubject {
  hotelId: string
  offerId: string
  guestId: string
}

const sign = (secret: string, payload: string): Buffer => {
  const key = createHmac("sha256", secret).update(`${TOKEN_NAMESPACE}:offer:v1`).digest()
  return createHmac("sha256", key).update(payload).digest()
}

const seal = (secret: string, parts: string[]): string => {
  const payload = parts.join("|")
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(secret, payload).toString("base64url")}`
}

function open(secret: string, token: string): string[] | null {
  const [body, signature, ...extra] = token.split(".")
  if (!body || !signature || extra.length) return null
  const payload = Buffer.from(body, "base64url").toString("utf8")
  const given = Buffer.from(signature, "base64url")
  const expected = sign(secret, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return payload.split("|")
}

/** The link a guest gets for one offer: not guessable, not forgeable, stateless. */
export const signOfferToken = (secret: string, subject: OfferSubject): string =>
  seal(secret, [VERSION, subject.hotelId, subject.offerId, subject.guestId])

export function verifyOfferToken(secret: string, token: string): OfferSubject | null {
  const [version, hotelId, offerId, guestId, ...rest] = open(secret, token) ?? []
  if (version !== VERSION || !hotelId || !offerId || !guestId || rest.length) return null
  return { hotelId, offerId, guestId }
}

const SIGN_UP_VERSION = "c1"

export interface SignUpSubject {
  hotelId: string
  offerId: string
  code: string
  language: HotelLanguage
}

/**
 * The link behind the code shown right after a public sign-up. It names the code and never the guest: the form takes
 * any phone, so what it hands out must not open anything about the guest who has that phone.
 */
export const signSignUpToken = (secret: string, subject: SignUpSubject): string =>
  seal(secret, [SIGN_UP_VERSION, subject.hotelId, subject.offerId, subject.code, subject.language])

export function verifySignUpToken(secret: string, token: string): SignUpSubject | null {
  const [version, hotelId, offerId, code, language, ...rest] = open(secret, token) ?? []
  const known = HOTEL_LANGUAGES.find((item) => item === language)
  if (version !== SIGN_UP_VERSION || !hotelId || !offerId || !code || !known || rest.length) return null
  return { hotelId, offerId, code, language: known }
}

/** The page a guest opens to show the offer, in their language (English has no prefix, like the rest of the site). */
export function offerPageUrl(webUrl: string, token: string, language: HotelLanguage): string {
  const prefix = language === "en" ? "" : `/${language}`
  return `${webUrl.replace(/\/$/, "")}${prefix}/o/${token}`
}
