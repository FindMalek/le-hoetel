import type { Locale } from "@le-hoetel/i18n/config"

export const HOTEL_EMAIL_KEYS = ["welcome", "birthday", "survey", "reminder"] as const
export type HotelEmailKey = (typeof HOTEL_EMAIL_KEYS)[number]

export interface EmailHotel {
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
  address?: string | null
}

export interface EmailGuest {
  name: string
  /** The signed preference page link of this guest, see `signUnsubscribeToken`. */
  unsubscribeUrl: string
}

export interface EmailOffer {
  title: string
  description?: string | null
  /** `YYYY-MM-DD`. */
  validUntil?: string | null
  code?: string | null
}

export interface EmailProps {
  welcome: { offer?: EmailOffer; ctaUrl?: string }
  birthday: { offer: EmailOffer; ctaUrl?: string }
  survey: { ctaUrl: string }
  reminder: { offer: EmailOffer; ctaUrl?: string }
}

export interface RenderEmailInput<Key extends HotelEmailKey> {
  hotel: EmailHotel
  guest: EmailGuest
  locale: Locale
  props: EmailProps[Key]
}
