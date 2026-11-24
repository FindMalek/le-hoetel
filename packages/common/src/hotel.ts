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
