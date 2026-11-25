import "server-only"
import type { CaptureInput, LeadInput } from "@le-hoetel/common/schemas"
import { createServerClient } from "@le-hoetel/orpc/server"
import { headers } from "next/headers"

/** Forwards the guest's ip so the api rate limits the guest, not this server. */
const api = createServerClient(async (): Promise<Record<string, string>> => {
  const forwarded = (await headers()).get("x-forwarded-for")
  return forwarded ? { "x-forwarded-for": forwarded } : {}
})

export const getPublicHotel = (slug: string) => api.public.hotel({ slug }).catch(() => null)

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
