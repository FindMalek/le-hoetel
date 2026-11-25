export const MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped_no_consent",
  "skipped_no_balance",
] as const
export type MessageStatus = (typeof MESSAGE_STATUSES)[number]
