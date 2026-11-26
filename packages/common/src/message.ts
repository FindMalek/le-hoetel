export const MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped_no_consent",
  "skipped_no_balance",
] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

/** What a message that was not really sent would have said: an email, or the WhatsApp text. */
export type MessagePreview = { subject: string; html: string } | { text: string }
