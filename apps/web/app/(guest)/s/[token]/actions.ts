"use server"

import { SURVEY_COMMENT_MAX } from "@ritorno/common/survey"
import { redirect } from "next/navigation"
import { submitSurvey } from "@/lib/api"

const rating = (form: FormData, key: string): number | undefined => {
  const value = Number(form.get(key))
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : undefined
}

export async function sendSurvey(token: string, lang: string | undefined, form: FormData): Promise<void> {
  const nps = Number(form.get("nps"))
  const comment = String(form.get("comment") ?? "").slice(0, SURVEY_COMMENT_MAX)
  const done = await submitSurvey({
    token,
    nps,
    rooms: rating(form, "rooms"),
    cleanliness: rating(form, "cleanliness"),
    service: rating(form, "service"),
    comment,
  }).then(
    () => true,
    () => false,
  )
  const query = new URLSearchParams()
  if (lang) query.set("lang", lang)
  if (!done) query.set("error", "1")
  redirect(`/s/${token}${query.size ? `?${query}` : ""}`)
}
