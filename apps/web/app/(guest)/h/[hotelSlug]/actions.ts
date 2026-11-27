"use server"

import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { CAPTURE_SOURCES, type CaptureSource } from "@ritorno/common/schemas"
import { type CaptureState, submitCapture } from "@/lib/capture"

const field = (form: FormData, key: string) => {
  const value = form.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function captureAction(form: FormData): Promise<CaptureState> {
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
    website: field(form, "website") || null,
    claim: field(form, "claim") || null,
    stayCheckOut: field(form, "stayCheckOut") || null,
    consents: {
      whatsapp: form.get("whatsapp") === "on",
      email: form.get("emailConsent") === "on" && !!email,
      profile: form.get("stayConsent") === "on",
    },
  })
}
