import { parsePhoneNumberFromString } from "libphonenumber-js/min"
import { toLatinDigits } from "./dial"

export const DEFAULT_PHONE_COUNTRY = "TN"

export interface ParsedPhone {
  e164: string
  /** ISO 3166-1 alpha-2, when the number maps to one country. */
  country: string | null
  /** False for numbers that can't take WhatsApp, like a Tunisian landline. */
  whatsappCapable: boolean
}

/** Tunisian mobiles start with 2, 4, 5 or 9. 3 and 7 are landlines, 8 is toll free. */
const TN_MOBILE = /^\+216[2459]\d{7}$/

export function isWhatsappCapable(e164: string): boolean {
  return e164.startsWith("+216") ? TN_MOBILE.test(e164) : true
}

/**
 * Turns what a person types into E.164. Accepts the Tunisian local 8 digits (`20 123 456`), `+216…`, `00216…`,
 * any other international number, spaces, dots, dashes, brackets and Arabic-Indic digits. Null when it isn't a valid number.
 */
export function parsePhone(input: string, defaultCountry: string = DEFAULT_PHONE_COUNTRY): ParsedPhone | null {
  let value = toLatinDigits(input).trim()
  if (value.startsWith("00")) value = `+${value.slice(2).trimStart()}`
  const parsed = parsePhoneNumberFromString(value, defaultCountry as "TN")
  if (!parsed?.isValid()) return null
  return { e164: parsed.number, country: parsed.country ?? null, whatsappCapable: isWhatsappCapable(parsed.number) }
}

/** For display: `+21696818091` becomes `+216 96 818 091`. Anything that doesn't parse is shown as stored. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164
}

/** Never put a full number in a log or an error: `+216 ** *** 456`. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 4)} ${"*".repeat(Math.max(0, e164.length - 7))} ${e164.slice(-3)}`
}
