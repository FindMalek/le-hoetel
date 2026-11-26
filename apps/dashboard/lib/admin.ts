import type { HotelHealth, HotelStatus } from "@ritorno/common/hotel"
import type { StatusTone } from "@ritorno/ui/components/status-badge"

export const consentRate = (hotel: { guestCount: number; consentedCount: number }): number | null =>
  hotel.guestCount ? Math.round((hotel.consentedCount / hotel.guestCount) * 100) : null

export const daysUntil = (date: Date, now: Date): number => Math.ceil((date.getTime() - now.getTime()) / 86_400_000)

/** Health badge look: only the healthy state is calm, the others ask for a follow up. */
export const HEALTH_TONE: Record<HotelHealth, StatusTone> = {
  healthy: "success",
  quiet: "warning",
  "no-guests": "warning",
  "no-owner": "warning",
  suspended: "danger",
}

export const STATUS_TONE: Record<HotelStatus, StatusTone> = { pilot: "info", active: "success", suspended: "danger" }

export const PILOT_ENDING_DAYS = 14

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

/** The audit filters' "no filter" value: an empty one renders as the Select placeholder, muted. */
export const AUDIT_ALL = "all"
