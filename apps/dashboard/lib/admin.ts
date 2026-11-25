import type { HotelHealth } from "@ritorno/common/hotel"

export const consentRate = (hotel: { guestCount: number; consentedCount: number }): number | null =>
  hotel.guestCount ? Math.round((hotel.consentedCount / hotel.guestCount) * 100) : null

export const daysUntil = (date: Date, now: Date): number => Math.ceil((date.getTime() - now.getTime()) / 86_400_000)

/** Health badge look: only the healthy state is calm, the others ask for a follow up. */
export const HEALTH_TONE: Record<HotelHealth, "secondary" | "outline" | "destructive"> = {
  healthy: "secondary",
  quiet: "outline",
  "no-guests": "outline",
  "no-owner": "outline",
  suspended: "destructive",
}

export const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)

export const logoSrc = (logoKey: string | null): string | null => (logoKey ? `/api/files/${logoKey}` : null)

export const TIMEZONES = [
  "Africa/Tunis",
  "Europe/Paris",
  "Europe/London",
  "Africa/Algiers",
  "Africa/Casablanca",
  "Africa/Cairo",
  "Asia/Dubai",
] as const
