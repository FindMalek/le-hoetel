"use client"

import { isPhoneComplete } from "@ritorno/common/dial"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { type CountryPickerCopy, PhoneInput, usePhoneNumber } from "@ritorno/ui/components/phone-input"
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { requestDemo } from "@/app/actions"
import type { CaptureResult } from "@/lib/capture"

export interface DemoCopy {
  name: string
  nameError: string
  hotel: string
  hotelError: string
  phone: string
  phoneError: string
  countryPicker: CountryPickerCopy
  city: string
  cityError: string
  language: string
  submit: string
  hint: string
  thanksTitle: string
  thanksBody: string
  errorInvalid: string
  errorTooMany: string
}

const LANGUAGE_NAMES: Record<HotelLanguage, string> = { en: "English", fr: "Français", ar: "العربية" }
const CONTROL =
  "h-12 w-full min-w-0 rounded-input border border-input bg-background px-4 text-base outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-destructive"

function FieldError({ id, children }: { id: string; children?: string | null }) {
  return (
    <p id={id} role="alert" hidden={!children} className="flex items-center gap-1.5 text-destructive text-sm">
      {children ? <CircleAlertIcon aria-hidden className="size-4 shrink-0" /> : null}
      {children}
    </p>
  )
}

export function DemoForm({ language, locale, copy }: { language: HotelLanguage; locale: string; copy: DemoCopy }) {
  const [values, setValues] = useState({ name: "", hotel: "", city: "" })
  const phone = usePhoneNumber({ detect: true })
  const [tried, setTried] = useState(false)
  const [result, setResult] = useState<CaptureResult | "idle">("idle")
  const [pending, start] = useTransition()

  const rejected = result.startsWith("invalid:") ? result.slice("invalid:".length) : null
  const bad = {
    name: values.name.trim().length < 2,
    hotel: values.hotel.trim().length < 2,
    phone: !isPhoneComplete(phone.number),
    city: values.city.trim().length < 2,
  }
  const wrong = (key: keyof typeof bad) => (tried && bad[key]) || rejected === key
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  /** A server error leaves with the first edit of the form. */
  const clearRejected = () => rejected && setResult("idle")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTried(true)
    const form = event.currentTarget
    if (Object.values(bad).some(Boolean)) {
      const first = (["name", "hotel", "phone", "city"] as const).find((key) => bad[key])
      form.querySelector<HTMLElement>(`#demo-${first}`)?.focus()
      return
    }
    const data = new FormData(form)
    start(async () => {
      const next = await requestDemo(data)
      setResult(next)
      if (next.startsWith("invalid:")) form.querySelector<HTMLElement>(`#demo-${next.slice(8)}`)?.focus()
    })
  }

  if (result === "done") {
    return (
      <div
        role="status"
        className="grid content-center justify-items-start gap-3 rounded-card border bg-card p-8 shadow-md"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon aria-hidden className="size-6" />
        </span>
        <p className="font-semibold text-h3 tracking-tight">
          {copy.thanksTitle.replace("{name}", values.name.trim().split(/\s+/)[0] ?? "")}
        </p>
        <p className="text-muted-foreground">{copy.thanksBody}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      onChange={clearRejected}
      noValidate
      className="grid gap-5 rounded-card border bg-card p-5 shadow-md md:p-8"
    >
      <input type="hidden" name="phone" value={phone.number} />
      <div aria-hidden className="sr-only">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-2">
        <label htmlFor="demo-name" className="font-medium text-sm">
          {copy.name}
        </label>
        <input
          id="demo-name"
          name="name"
          value={values.name}
          onChange={set("name")}
          autoComplete="name"
          enterKeyHint="next"
          maxLength={100}
          aria-invalid={wrong("name")}
          aria-describedby="demo-name-error"
          className={CONTROL}
        />
        <FieldError id="demo-name-error">{wrong("name") ? copy.nameError : null}</FieldError>
      </div>
      <div className="grid gap-2">
        <label htmlFor="demo-hotel" className="font-medium text-sm">
          {copy.hotel}
        </label>
        <input
          id="demo-hotel"
          name="hotel"
          value={values.hotel}
          onChange={set("hotel")}
          autoComplete="organization"
          enterKeyHint="next"
          maxLength={120}
          aria-invalid={wrong("hotel")}
          aria-describedby="demo-hotel-error"
          className={CONTROL}
        />
        <FieldError id="demo-hotel-error">{wrong("hotel") ? copy.hotelError : null}</FieldError>
      </div>
      <div className="grid gap-2">
        <label htmlFor="demo-phone" className="font-medium text-sm">
          {copy.phone}
        </label>
        <PhoneInput
          id="demo-phone"
          value={phone.value}
          onValueChange={(next) => {
            phone.setValue(next)
            clearRejected()
          }}
          locale={locale}
          copy={copy.countryPicker}
          enterKeyHint="next"
          aria-invalid={wrong("phone")}
          aria-describedby="demo-phone-error"
          className="h-12 rounded-input bg-background"
        />
        <FieldError id="demo-phone-error">{wrong("phone") ? copy.phoneError : null}</FieldError>
      </div>
      <div className="grid gap-2">
        <label htmlFor="demo-city" className="font-medium text-sm">
          {copy.city}
        </label>
        <input
          id="demo-city"
          name="city"
          value={values.city}
          onChange={set("city")}
          autoComplete="address-level2"
          enterKeyHint="done"
          maxLength={80}
          aria-invalid={wrong("city")}
          aria-describedby="demo-city-error"
          className={CONTROL}
        />
        <FieldError id="demo-city-error">{wrong("city") ? copy.cityError : null}</FieldError>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-medium text-sm">{copy.language}</legend>
        <div className="grid grid-cols-3 gap-2">
          {HOTEL_LANGUAGES.map((option) => (
            <label key={option} className="cursor-pointer">
              <input
                type="radio"
                name="language"
                value={option}
                defaultChecked={option === language}
                className="peer sr-only"
              />
              <span
                lang={option}
                className="flex h-11 items-center justify-center rounded-full border font-medium text-sm transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
              >
                {LANGUAGE_NAMES[option]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div aria-live="polite" className="grid gap-3">
        {result === "invalid" || result === "tooMany" ? (
          <p role="alert" className="flex items-center gap-1.5 text-destructive text-sm">
            <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
            {result === "invalid" ? copy.errorInvalid : copy.errorTooMany}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 font-medium text-base text-primary-foreground transition-opacity duration-150 disabled:opacity-70"
        >
          {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : null}
          {copy.submit}
        </button>
        <p className="text-center text-muted-foreground text-xs">{copy.hint}</p>
      </div>
    </form>
  )
}
