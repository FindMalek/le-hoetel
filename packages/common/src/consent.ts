import type { HotelLanguage } from "./hotel"

/** Bump on every wording change (after legal review). Each consent event stores the version the guest saw. */
export const CONSENT_WORDING_VERSION = "2026-11-draft-1"

/** What a guest can say yes or no to. `email` and `whatsapp` are message channels, `profile` unlocks the optional details tier. */
export const CONSENT_CHANNELS = ["email", "whatsapp", "profile"] as const
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number]

export const MESSAGE_CHANNELS = ["email", "whatsapp"] as const
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]

export const GUEST_SOURCES = ["qr_room", "qr_table", "qr_front_desk", "staff", "csv"] as const
export type GuestSource = (typeof GUEST_SOURCES)[number]

/** Where a consent change came from: how the guest was captured, or a later change of mind. */
export const CONSENT_SOURCES = [...GUEST_SOURCES, "unsubscribe_link", "stop_reply", "guest_request"] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]

/**
 * The only place the consent text lives, so legal can edit it here. `{hotel}` is replaced by the hotel's display name.
 * Draft: not yet reviewed by a lawyer.
 */
export const CONSENT_WORDING: Record<ConsentChannel, Record<HotelLanguage, string>> = {
  whatsapp: {
    en: "I agree that {hotel} may send me offers and news on WhatsApp. I can reply STOP at any time.",
    fr: "J'accepte que {hotel} m'envoie des offres et des nouvelles sur WhatsApp. Je peux répondre STOP à tout moment.",
    ar: "أوافق على أن يرسل لي {hotel} عروضًا وأخبارًا عبر واتساب. يمكنني الرد بكلمة STOP في أي وقت.",
  },
  email: {
    en: "I agree that {hotel} may send me offers and news by email. I can unsubscribe at any time.",
    fr: "J'accepte que {hotel} m'envoie des offres et des nouvelles par e-mail. Je peux me désabonner à tout moment.",
    ar: "أوافق على أن يرسل لي {hotel} عروضًا وأخبارًا عبر البريد الإلكتروني. يمكنني إلغاء الاشتراك في أي وقت.",
  },
  profile: {
    en: "I agree that {hotel} may keep where I come from and my stay dates to welcome me better. I can ask to delete them at any time.",
    fr: "J'accepte que {hotel} conserve mon pays d'origine et mes dates de séjour pour mieux m'accueillir. Je peux demander leur suppression à tout moment.",
    ar: "أوافق على أن يحتفظ {hotel} ببلد إقامتي وتواريخ إقامتي لاستقبالي بشكل أفضل. يمكنني طلب حذفها في أي وقت.",
  },
}

export function consentWording(channel: ConsentChannel, language: HotelLanguage, hotelName: string): string {
  return CONSENT_WORDING[channel][language].replaceAll("{hotel}", hotelName)
}
