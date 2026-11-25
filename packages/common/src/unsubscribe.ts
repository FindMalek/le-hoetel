import { createHmac, timingSafeEqual } from "node:crypto"
import { MESSAGE_CHANNELS, type MessageChannel } from "./consent"
import type { HotelLanguage } from "./hotel"

const VERSION = "v1"

export interface UnsubscribeSubject {
  hotelId: string
  guestId: string
  /** The channel of the message that carried the link. The page it opens lets the guest change every channel. */
  channel: MessageChannel
}

const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url")
const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8")

const sign = (secret: string, payload: string): Buffer => {
  const key = createHmac("sha256", secret).update("le-hoetel:unsubscribe:v1").digest()
  return createHmac("sha256", key).update(payload).digest()
}

/** Not guessable and not forgeable: the guest, hotel and channel signed with the server secret. Stateless, so it never expires and needs no table. */
export function signUnsubscribeToken(secret: string, subject: UnsubscribeSubject): string {
  const payload = [VERSION, subject.hotelId, subject.guestId, subject.channel].join("|")
  return `${encode(payload)}.${sign(secret, payload).toString("base64url")}`
}

/** The subject of a token this server signed, or null for anything else. */
export function verifyUnsubscribeToken(secret: string, token: string): UnsubscribeSubject | null {
  const [body, signature, ...extra] = token.split(".")
  if (!body || !signature || extra.length) return null
  const payload = decode(body)
  const given = Buffer.from(signature, "base64url")
  const expected = sign(secret, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const [version, hotelId, guestId, channel, ...rest] = payload.split("|")
  if (version !== VERSION || !hotelId || !guestId || rest.length) return null
  if (!MESSAGE_CHANNELS.some((known) => known === channel)) return null
  return { hotelId, guestId, channel: channel as MessageChannel }
}

/** The preference page the guest opens, in their language (English has no prefix, like the rest of the site). */
export function unsubscribePageUrl(webUrl: string, token: string, language: HotelLanguage): string {
  const prefix = language === "en" ? "" : `/${language}`
  return `${webUrl.replace(/\/$/, "")}${prefix}/u/${token}`
}

/** The api endpoint a mail client POSTs to for a one tap unsubscribe (RFC 8058). */
export function unsubscribeOneClickUrl(apiUrl: string, token: string): string {
  return `${apiUrl.replace(/\/$/, "")}/unsubscribe/${token}`
}

/** Headers every marketing email carries so Gmail and Apple Mail show their own unsubscribe button. */
export function listUnsubscribeHeaders(apiUrl: string, token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeOneClickUrl(apiUrl, token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

const FOOTERS: Record<MessageChannel, Record<HotelLanguage, string>> = {
  whatsapp: {
    en: "Reply STOP to unsubscribe.",
    fr: "Répondez STOP pour vous désabonner.",
    ar: "للإلغاء أرسل STOP.",
  },
  email: {
    en: "Unsubscribe: {url}",
    fr: "Se désabonner : {url}",
    ar: "إلغاء الاشتراك: {url}",
  },
}

/** The line every message ends with: STOP on WhatsApp, the preference page link on email. */
export function unsubscribeFooter(channel: MessageChannel, language: HotelLanguage, pageUrl: string): string {
  return FOOTERS[channel][language].replace("{url}", pageUrl)
}

const STOP_CONFIRMATIONS: Record<HotelLanguage, string> = {
  en: "You are unsubscribed from WhatsApp messages. We won't write to you here again.",
  fr: "Vous êtes désabonné des messages WhatsApp. Nous ne vous écrirons plus ici.",
  ar: "تم إلغاء اشتراكك في رسائل واتساب. لن نراسلك هنا مرة أخرى.",
}

/** The reply to a STOP, in the guest's language. */
export const stopConfirmation = (language: HotelLanguage): string => STOP_CONFIRMATIONS[language]

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

const STOP_WORDS = new Set(
  [
    "stop",
    "unsubscribe",
    "cancel",
    "end",
    "quit",
    "arret",
    "arreter",
    "desabonner",
    "desabonnement",
    "desinscription",
    "توقف",
    "إيقاف",
    "إلغاء",
    "إلغاء الاشتراك",
  ].map(normalize),
)

/**
 * Whether an inbound WhatsApp message is a STOP request. The whole message must be the keyword, so "don't stop
 * the music" never unsubscribes anyone. Handles case, accents, punctuation and the French and Arabic words.
 */
export function isStopKeyword(text: string): boolean {
  return STOP_WORDS.has(normalize(text))
}
