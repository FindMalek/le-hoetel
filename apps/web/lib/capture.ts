import "server-only"
import type { CaptureInput, LeadInput } from "@ritorno/common/schemas"
import { guestApi as api } from "./api"

export const getPublicHotel = (slug: string) => api.public.hotel({ slug }).catch(() => null)

export const getWhatsAppLink = (input: Parameters<typeof api.public.whatsappLink>[0]) =>
  api.public
    .whatsappLink(input)
    .then((link) => link.url)
    .catch(() => null)

export type CaptureResult = "done" | "invalid" | "tooMany"

export async function submitCapture(input: CaptureInput): Promise<CaptureResult> {
  try {
    await api.public.capture(input)
    return "done"
  } catch (error) {
    return (error as { code?: string }).code === "TOO_MANY_REQUESTS" ? "tooMany" : "invalid"
  }
}

export async function submitLead(input: LeadInput): Promise<CaptureResult> {
  try {
    await api.leads.request(input)
    return "done"
  } catch (error) {
    return (error as { code?: string }).code === "TOO_MANY_REQUESTS" ? "tooMany" : "invalid"
  }
}
