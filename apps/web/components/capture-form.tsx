"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { PhoneInput } from "@le-hoetel/ui/components/phone-input"
import { useActionState, useState } from "react"
import { type CaptureState, captureAction } from "@/app/h/[hotelSlug]/actions"

export interface CaptureCopy {
  name: string
  phone: string
  dialCode: string
  language: string
  birthday: string
  email: string
  consentTitle: string
  consentHint: string
  emailNeeded: string
  submit: string
  sending: string
  thanksTitle: string
  thanksBody: string
  errorInvalid: string
  errorTooMany: string
  whatsappWording: string
  emailWording: string
}

const LANGUAGE_NAMES: Record<HotelLanguage, string> = { en: "English", fr: "Français", ar: "العربية" }
const CONTROL =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50 md:text-sm"

export function CaptureForm(props: {
  slug: string
  source: string
  location: string
  renderedAt: number
  language: HotelLanguage
  copy: CaptureCopy
}) {
  const { copy } = props
  const [state, action, pending] = useActionState<CaptureState, FormData>(captureAction, "idle")
  const [dialCode, setDialCode] = useState("+216")
  const [national, setNational] = useState("")
  const [email, setEmail] = useState("")
  const [emailConsent, setEmailConsent] = useState(false)

  if (state === "done") {
    return (
      <div role="status" className="border bg-card p-5">
        <h2 className="font-heading font-semibold text-xl">{copy.thanksTitle}</h2>
        <p className="mt-2 text-muted-foreground">{copy.thanksBody}</p>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="source" value={props.source} />
      <input type="hidden" name="location" value={props.location} />
      <input type="hidden" name="renderedAt" value={props.renderedAt} />
      <div aria-hidden className="sr-only">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="phone" value={`${dialCode}${national.replace(/\s/g, "").replace(/^0+/, "")}`} />

      <label className="flex flex-col gap-1.5 text-sm">
        {copy.name}
        <input name="name" required maxLength={120} autoComplete="name" className={CONTROL} />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="capture-phone">{copy.phone}</label>
        <PhoneInput
          id="capture-phone"
          required
          value={national}
          onValueChange={setNational}
          dialCode={dialCode}
          onDialCodeChange={setDialCode}
          dialCodeLabel={copy.dialCode}
        />
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        {copy.language}
        <select name="language" defaultValue={props.language} className={CONTROL}>
          {HOTEL_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {LANGUAGE_NAMES[language]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        {copy.birthday}
        <input type="date" name="birthday" autoComplete="bday" className={CONTROL} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        {copy.email}
        <input
          type="email"
          name="email"
          maxLength={200}
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={CONTROL}
        />
      </label>

      <fieldset className="flex flex-col gap-3 border p-3">
        <legend className="px-1 font-medium text-sm">{copy.consentTitle}</legend>
        <p className="text-muted-foreground text-xs">{copy.consentHint}</p>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="whatsapp" className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>{copy.whatsappWording}</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="emailConsent"
            checked={emailConsent}
            onChange={(event) => setEmailConsent(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>{copy.emailWording}</span>
        </label>
        {emailConsent && !email && <p className="text-destructive text-xs">{copy.emailNeeded}</p>}
      </fieldset>

      {state === "invalid" && (
        <p role="alert" className="text-destructive text-sm">
          {copy.errorInvalid}
        </p>
      )}
      {state === "tooMany" && (
        <p role="alert" className="text-destructive text-sm">
          {copy.errorTooMany}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (emailConsent && !email)}
        className="h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm disabled:opacity-50"
      >
        {pending ? copy.sending : copy.submit}
      </button>
    </form>
  )
}
