"use server"

import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { type CaptureResult, submitLead } from "@/lib/capture"

const field = (form: FormData, key: string) => {
  const value = form.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export async function requestDemo(form: FormData): Promise<CaptureResult> {
  const language = field(form, "language")
  return submitLead({
    name: field(form, "name"),
    hotel: field(form, "hotel"),
    phone: field(form, "phone"),
    city: field(form, "city"),
    language: HOTEL_LANGUAGES.find((l) => l === language) ?? "fr",
    website: field(form, "website") || null,
  })
}
