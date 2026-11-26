export const MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped_no_consent",
  "skipped_no_balance",
] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

/** The guest emails the product sends: also the template filter of the message log. */
export const HOTEL_EMAIL_KEYS = ["welcome", "birthday", "survey", "reminder", "message"] as const
export type HotelEmailKey = (typeof HOTEL_EMAIL_KEYS)[number]

/** What a message that was not really sent would have said: an email, or the WhatsApp text. */
export type MessagePreview = { subject: string; html: string } | { text: string }
