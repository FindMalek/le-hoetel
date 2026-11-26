import type { Guest } from "./schemas"

export interface ExportedConsentEvent {
  channel: string
  granted: boolean
  source: string
  wordingVersion: string
  at: Date
}

const COLUMNS = [
  "name",
  "phone",
  "language",
  "email",
  "birthday",
  "source",
  "country",
  "city",
  "stay_check_in",
  "stay_check_out",
  "next_destination",
  "consent_email",
  "consent_whatsapp",
  "consent_profile",
  "created_at",
  "feedback_follow_up",
  "whatsapp_scans",
  "consent_log",
] as const

/** Quotes a cell, and defuses a leading `=`, `+`, `-`, `@` so a guest named `=HYPERLINK(...)` can't run in Excel. */
export function csvCell(value: string | number | boolean | Date | null | undefined): string {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "")
  if (/^[=+\-@\t\r]/.test(text) && !/^\+\d+$/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const logLine = (event: ExportedConsentEvent): string =>
  `${event.at.toISOString()} ${event.channel} ${event.granted ? "granted" : "withdrawn"} ${event.source} ${event.wordingVersion}`

export interface ExportedFeedback {
  status: string
  notes: string | null
  nps: number
  comment: string | null
  submittedAt: Date
}

const feedbackLine = (item: ExportedFeedback): string =>
  [
    `${item.submittedAt.toISOString()} ${item.nps}/10 ${item.status}`,
    item.comment && `comment: ${item.comment}`,
    item.notes && `notes: ${item.notes}`,
  ]
    .filter(Boolean)
    .join(" ")

export interface ExportedScan {
  source: string
  location: string | null
  lastScanAt: Date
}

const scanLine = (scan: ExportedScan): string =>
  [scan.lastScanAt.toISOString(), scan.source, scan.location].filter(Boolean).join(" ")

/** One row per guest, with the feedback follow-up and the consent log (last column) folded into one cell each. The json export has them as proper rows. */
export function guestsToCsv(
  rows: {
    guest: Guest
    consentEvents: ExportedConsentEvent[]
    feedback?: ExportedFeedback[]
    whatsappScans?: ExportedScan[]
  }[],
): string {
  const lines = rows.map(({ guest, consentEvents, feedback = [], whatsappScans = [] }) =>
    [
      guest.name,
      guest.phoneE164,
      guest.language,
      guest.email,
      guest.birthday,
      guest.source,
      guest.country,
      guest.city,
      guest.stayCheckIn,
      guest.stayCheckOut,
      guest.nextDestination,
      guest.consents.email,
      guest.consents.whatsapp,
      guest.consents.profile,
      guest.createdAt,
      feedback.map(feedbackLine).join(" | "),
      whatsappScans.map(scanLine).join(" | "),
      consentEvents.map(logLine).join(" | "),
    ]
      .map(csvCell)
      .join(","),
  )
  return `${[COLUMNS.join(","), ...lines].join("\r\n")}\r\n`
}
