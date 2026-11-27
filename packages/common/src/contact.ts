import { isWhatsappCapable } from "./phone"

/**
 * What staff may open by hand, from their own phone or mailbox. Writing (email, WhatsApp) needs the guest's consent for
 * that channel. A phone call is not a message, so the number is always there to dial.
 */
export function contactChannels(guest: {
  phoneE164: string
  email: string | null
  consents: { email: boolean; whatsapp: boolean }
}): { email: string | null; whatsapp: boolean } {
  return {
    email: guest.consents.email ? guest.email : null,
    whatsapp: guest.consents.whatsapp && isWhatsappCapable(guest.phoneE164),
  }
}
