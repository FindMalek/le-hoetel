"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { PhoneInput } from "@le-hoetel/ui/components/phone-input"
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { type FormEvent, useState, useTransition } from "react"
import { requestDemo } from "@/app/actions"

export interface DemoCopy {
  name: string
  nameError: string
  hotel: string
  hotelError: string
  phone: string
  phoneError: string
  dialCode: string
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
  "h-12 w-full min-w-0 rounded-xl border border-input bg-background px-4 text-base outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"

function Error({ id, children }: { id: string; children?: string | null }) {
  return (
    <p id={id} role="alert" hidden={!children} className="flex items-center gap-1.5 text-destructive text-sm">
      {children ? <CircleAlertIcon aria-hidden className="size-4 shrink-0" /> : null}
      {children}
    </p>
  )
}

export function DemoForm({ language, copy }: { language: HotelLanguage; copy: DemoCopy }) {
  const [values, setValues] = useState({ name: "", hotel: "", city: "" })
  const [dialCode, setDialCode] = useState("+216")
  const [national, setNational] = useState("")
  const [tried, setTried] = useState(false)
  const [result, setResult] = useState<"idle" | "done" | "invalid" | "tooMany">("idle")
  const [pending, start] = useTransition()

  const digits = national.replace(/\D/g, "").replace(/^0+/, "")
  const bad = {
    name: values.name.trim().length < 2,
    hotel: values.hotel.trim().length < 2,
    phone: digits.length < 6 || digits.length > 12,
    city: values.city.trim().length < 2,
  }
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

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
    start(async () => setResult(await requestDemo(data)))
  }

  if (result === "done") {
    return (
      <div role="status" className="grid content-center justify-items-start gap-3 rounded-xl border bg-card p-8">
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
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-xl border bg-card p-5 md:p-8">
      <input type="hidden" name="phone" value={`${dialCode}${digits}`} />
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
          aria-invalid={tried && bad.name}
          aria-describedby="demo-name-error"
          className={CONTROL}
        />
        <Error id="demo-name-error">{tried && bad.name ? copy.nameError : null}</Error>
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
          aria-invalid={tried && bad.hotel}
          aria-describedby="demo-hotel-error"
          className={CONTROL}
        />
        <Error id="demo-hotel-error">{tried && bad.hotel ? copy.hotelError : null}</Error>
      </div>
      <div className="grid gap-2">
        <label htmlFor="demo-phone" className="font-medium text-sm">
          {copy.phone}
        </label>
        <PhoneInput
          id="demo-phone"
          value={national}
          onValueChange={setNational}
          dialCode={dialCode}
          onDialCodeChange={setDialCode}
          dialCodeLabel={copy.dialCode}
          enterKeyHint="next"
          aria-invalid={tried && bad.phone}
          aria-describedby="demo-phone-error"
          className="h-12 rounded-xl bg-background"
        />
        <Error id="demo-phone-error">{tried && bad.phone ? copy.phoneError : null}</Error>
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
          aria-invalid={tried && bad.city}
          aria-describedby="demo-city-error"
          className={CONTROL}
        />
        <Error id="demo-city-error">{tried && bad.city ? copy.cityError : null}</Error>
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
                className="flex h-11 items-center justify-center rounded-xl border font-medium text-sm transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40"
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
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-base text-primary-foreground transition-opacity duration-150 disabled:opacity-70"
        >
          {pending ? <LoaderCircleIcon aria-hidden className="size-4 animate-spin" /> : null}
          {copy.submit}
        </button>
        <p className="text-center text-muted-foreground text-xs">{copy.hint}</p>
      </div>
    </form>
  )
}
