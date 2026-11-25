/**
 * What a WhatsApp message costs the hotel, in TND millimes (1 TND = 1000 millimes, always integers).
 * Cost values are UNTESTED GUESSES from Meta's public per-message rates (about 0.008 USD for a utility
 * template and 0.03 USD for a marketing one, 1 TND = 0.32 USD). Check them against the Meta invoice and
 * the Kapso markup before the first paying hotel. Email is free for the hotel and is not priced.
 */
export const WHATSAPP_COST_MILLIMES = {
  welcome: 25,
  survey: 25,
  reminder: 25,
  birthday: 95,
  message: 95,
} as const

export type PricedMessageKey = keyof typeof WHATSAPP_COST_MILLIMES

export const MESSAGE_MARGIN_PERCENT = 25

/** Below this balance the hotel sees a warning (5 TND). */
export const LOW_BALANCE_MILLIMES = 5000

export function whatsappPriceMillimes(key: string): number {
  const cost = WHATSAPP_COST_MILLIMES[key as PricedMessageKey] ?? WHATSAPP_COST_MILLIMES.message
  return Math.ceil((cost * (100 + MESSAGE_MARGIN_PERCENT)) / 100)
}

/** "12.500 TND" in the viewer's locale, from integer millimes. */
export function formatTnd(millimes: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-TN-u-nu-latn" : locale, {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 3,
  }).format(millimes / 1000)
}
