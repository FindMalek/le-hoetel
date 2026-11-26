import "server-only"
import type { CaptureInput, LeadInput } from "@ritorno/common/schemas"
import { createServerClient } from "@ritorno/orpc/server"
import { headers } from "next/headers"

/** Forwards the guest's ip so the api rate limits the guest, not this server. */
const api = createServerClient(async (): Promise<Record<string, string>> => {
  const forwarded = (await headers()).get("x-forwarded-for")
  return forwarded ? { "x-forwarded-for": forwarded } : {}
})

export const getPublicHotel = (slug: string) => api.public.hotel({ slug }).catch(() => null)

export const getWhatsAppLink = (input: Parameters<typeof api.public.whatsappLink>[0]) =>
  api.public
    .whatsappLink(input)
    .then((link) => link.url)
    .catch(() => null)

export type CaptureResult = "done" | "invalid" | "tooMany"

/** "failed" is everything that is not the guest's input or the limit: nothing was saved, they can try again. */
export async function submitCapture(input: CaptureInput): Promise<CaptureResult | "failed"> {
  try {
    await api.public.capture(input)
    return "done"
  } catch (error) {
    const { code } = error as { code?: string }
    if (code === "TOO_MANY_REQUESTS") return "tooMany"
    return code === "BAD_REQUEST" ? "invalid" : "failed"
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
