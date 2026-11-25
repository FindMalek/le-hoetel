import type { Locale } from "@le-hoetel/i18n/config"
import type { EmailGuest, EmailOffer, EmailProps, HotelEmailKey } from "./types"

const OFFERS: Record<Locale, EmailOffer> = {
  en: { title: "Free breakfast for two", description: "Enjoy it on your next stay.", code: "WELCOME" },
  fr: {
    title: "Petit-déjeuner offert pour deux",
    description: "À savourer lors de votre prochain séjour.",
    code: "WELCOME",
  },
  ar: { title: "إفطار مجاني لشخصين", description: "استمتع به في إقامتك القادمة.", code: "WELCOME" },
}

const MESSAGES: Record<Locale, { subject: string; title: string; body: string }> = {
  en: {
    subject: "News from {hotel}",
    title: "A little news, {name}",
    body: "We have something new to share with you.",
  },
  fr: {
    subject: "Des nouvelles de {hotel}",
    title: "Un petit mot, {name}",
    body: "Nous avons une nouveauté à partager avec vous.",
  },
  ar: { subject: "أخبار من {hotel}", title: "رسالة صغيرة، {name}", body: "لدينا خبر جديد نود مشاركته معك." },
}

const GUESTS: Record<Locale, string> = { en: "Sara", fr: "Sara", ar: "سارة" }

export const sampleGuest = (locale: Locale, unsubscribeUrl: string): EmailGuest => ({
  name: GUESTS[locale],
  unsubscribeUrl,
})

/** Sample props for the dashboard preview and test sends: what a hotel sees before any real guest gets the email. */
export function sampleProps<Key extends HotelEmailKey>(key: Key, locale: Locale, ctaUrl: string): EmailProps[Key]
export function sampleProps(key: HotelEmailKey, locale: Locale, ctaUrl: string): EmailProps[HotelEmailKey] {
  const offer = { ...OFFERS[locale], validUntil: "2026-12-31" }
  if (key === "survey") return { ctaUrl }
  if (key === "message") return { ...MESSAGES[locale], offer, ctaUrl }
  return { offer, ctaUrl }
}
