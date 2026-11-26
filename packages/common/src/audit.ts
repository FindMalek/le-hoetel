/**
 * Every action the audit log can hold. Writers are typed against it, and each one needs an en, fr and ar label in
 * `adminAudit.actions`. The log is append only, so an action nothing writes anymore stays here for its old rows.
 */
export const AUDIT_ACTIONS = [
  "admin.impersonate",
  "admin.impersonate-stop",
  "admin.user-ban",
  "admin.user-unban",
  "campaign.cancel",
  "campaign.create",
  "campaign.delete",
  "campaign.schedule",
  "email.send-test",
  "feedback-case.update",
  "guest.consent",
  "guest.delete",
  "guest.delete-all",
  "guest.export",
  "guest.export-all",
  "guest.import",
  "holiday.update",
  "hotel.admin-update",
  "hotel.alerts.link",
  "hotel.alerts.unlink",
  "hotel.balance.top_up",
  "hotel.create",
  "hotel.delete",
  "hotel.logo-remove",
  "hotel.logo-set",
  "hotel.update",
  "note.delete",
  "offer.create",
  "offer.delete",
  "offer.redeem",
  "offer.update",
  "privacy.delete-account",
  "privacy.export",
  "profile.update",
  "whatsapp-scan.delete",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
