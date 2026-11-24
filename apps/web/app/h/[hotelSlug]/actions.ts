"use server"

import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { CAPTURE_SOURCES, type CaptureSource } from "@le-hoetel/common/schemas"
import { type CaptureResult, submitCapture } from "@/lib/capture"

export type CaptureState = CaptureResult | "idle"

const field = (form: FormData, key: string) => {
  const value = form.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function captureAction(_previous: CaptureState, form: FormData): Promise<CaptureState> {
  const source = field(form, "source")
  const language = field(form, "language")
  const email = field(form, "email")
  return submitCapture({
    slug: field(form, "slug"),
    name: field(form, "name"),
    phone: field(form, "phone"),
    language: HOTEL_LANGUAGES.find((l) => l === language) ?? "fr",
    email: email || null,
    birthday: field(form, "birthday") || null,
    source: source in CAPTURE_SOURCES ? (source as CaptureSource) : "desk",
    location: field(form, "location") || null,
    consents: { whatsapp: form.get("whatsapp") === "on", email: form.get("emailConsent") === "on" && !!email },
  })
}
