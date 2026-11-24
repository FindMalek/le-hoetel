export const HOTEL_ROLES = ["owner", "manager", "staff"] as const
export type HotelRole = (typeof HOTEL_ROLES)[number]

export const HOTEL_LANGUAGES = ["en", "fr", "ar"] as const
export type HotelLanguage = (typeof HOTEL_LANGUAGES)[number]

export const HOTEL_PLANS = ["starter", "growth", "pro"] as const
export type HotelPlan = (typeof HOTEL_PLANS)[number]

export const HOTEL_STATUSES = ["pilot", "active", "suspended"] as const
export type HotelStatus = (typeof HOTEL_STATUSES)[number]

export const DEFAULT_HOTEL_LANGUAGE: HotelLanguage = "fr"
export const DEFAULT_HOTEL_TIMEZONE = "Africa/Tunis"

export const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
export const LOGO_MAX_BYTES = 1024 * 1024

export const HOTEL_HEALTHS = ["suspended", "no-owner", "no-guests", "quiet", "healthy"] as const
export type HotelHealth = (typeof HOTEL_HEALTHS)[number]

export const QUIET_AFTER_DAYS = 14

/** The first problem a hotel has, in the order the admin should chase it: owner not joined, no guests yet, then no new guest for two weeks. */
export function hotelHealth(hotel: {
  status: HotelStatus
  ownerCount: number
  guestCount: number
  lastGuestAt: Date | null
  now: Date
}): HotelHealth {
  if (hotel.status === "suspended") return "suspended"
  if (hotel.ownerCount === 0) return "no-owner"
  if (hotel.guestCount === 0 || !hotel.lastGuestAt) return "no-guests"
  const quietSince = hotel.now.getTime() - QUIET_AFTER_DAYS * 24 * 60 * 60 * 1000
  return hotel.lastGuestAt.getTime() < quietSince ? "quiet" : "healthy"
}
