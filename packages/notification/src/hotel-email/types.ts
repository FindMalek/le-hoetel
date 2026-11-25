import type { Locale } from "@ritorno/i18n/config"

export const HOTEL_EMAIL_KEYS = ["welcome", "birthday", "survey", "reminder", "message"] as const
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
  /** A text the hotel wrote itself (a holiday greeting, a campaign), already in the guest's language. `{name}` and `{hotel}` are filled in; a blank line starts a new paragraph. */
  message: { subject: string; title: string; body: string; offer?: EmailOffer; ctaUrl?: string; ctaLabel?: string }
}

export interface RenderEmailInput<Key extends HotelEmailKey> {
  hotel: EmailHotel
  guest: EmailGuest
  locale: Locale
  props: EmailProps[Key]
}
