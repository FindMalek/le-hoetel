"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { PhoneInput } from "@ritorno/ui/components/phone-input"
import { cn } from "@ritorno/ui/lib/utils"
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { captureAction } from "@/app/h/[hotelSlug]/actions"
import { ConsentToggle } from "./consent-toggle"

export interface CaptureCopy {
  name: string
  nameError: string
  phone: string
  phoneError: string
  dialCode: string
  language: string
  optionalTitle: string
  optionalHint: string
  birthday: string
  email: string
  consentTitle: string
  consentHint: string
  whatsappTitle: string
  emailTitle: string
  emailNeeded: string
  submit: string
  submitHint: string
  thanksTitle: string
  thanksBody: string
  thanksPerk: string
  errorInvalid: string
  errorTooMany: string
  whatsappWording: string
  emailWording: string
}

type Status = "idle" | "done" | "invalid" | "tooMany"

const LANGUAGE_NAMES: Record<HotelLanguage, string> = { en: "English", fr: "Français", ar: "العربية" }
const CONTROL =
  "h-12 w-full min-w-0 rounded-xl border border-input bg-background px-4 text-base outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-destructive"

const nationalDigits = (national: string) => national.replace(/\D/g, "").replace(/^0+/, "")

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-destructive text-sm" hidden={!children}>
      {children ? <CircleAlertIcon aria-hidden className="size-4 shrink-0" /> : null}
      {children}
    </p>
  )
}

function Check() {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => setDrawn(true), [])
  return (
    <span
      className={cn(
        "flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 ease-out motion-reduce:transition-none",
        drawn ? "scale-100" : "scale-75",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="22"
          className={cn(
            "transition-[stroke-dashoffset] delay-150 duration-400 ease-out motion-reduce:transition-none",
            drawn ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:22]",
          )}
        />
      </svg>
    </span>
  )
}

export function CaptureForm(props: {
  slug: string
  source: string
  location: string
  renderedAt: number
  language: HotelLanguage
  perk: ReactNode
  copy: CaptureCopy
}) {
  const { copy } = props
  const [status, setStatus] = useState<Status>("idle")
  const [name, setName] = useState("")
  const [dialCode, setDialCode] = useState("+216")
  const [national, setNational] = useState("")
  const [email, setEmail] = useState("")
  const [emailConsent, setEmailConsent] = useState(false)
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [tried, setTried] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const digits = nationalDigits(national)
  const nameBad = name.trim().length < 2
  const phoneBad = digits.length < 6 || digits.length > 12
  const emailMissing = emailConsent && !email.trim()
  const showName = (touched.name || tried) && nameBad
  const showPhone = (touched.phone || tried) && phoneBad
  const firstName = name.trim().split(/\s+/)[0] ?? ""

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTried(true)
    if (nameBad) {
      nameRef.current?.focus()
      return
    }
    if (phoneBad) {
      phoneRef.current?.focus()
      return
    }
    if (emailMissing) {
      setOptionalOpen(true)
      setTimeout(() => emailRef.current?.focus(), 0)
      return
    }
    const data = new FormData(event.currentTarget)
    setStatus("done")
    const result = await captureAction("idle", data)
    if (result !== "done") setStatus(result)
  }

  return (
    <>
      {status === "done" ? (
        <div role="status" className="flex flex-col items-center gap-6 py-10 text-center">
          <Check />
          <div className="grid gap-2">
            <h2 className="text-balance font-semibold text-2xl tracking-tight">
              {copy.thanksTitle.replace("{name}", firstName)}
            </h2>
            <p className="text-muted-foreground">{copy.thanksBody}</p>
          </div>
          <div className="grid w-full gap-3">
            {props.perk}
            <p className="text-muted-foreground text-sm">{copy.thanksPerk}</p>
          </div>
        </div>
      ) : null}
      <form onSubmit={submit} noValidate hidden={status === "done"} className="flex flex-col gap-6">
        {props.perk}
        <input type="hidden" name="slug" value={props.slug} />
        <input type="hidden" name="source" value={props.source} />
        <input type="hidden" name="location" value={props.location} />
        <input type="hidden" name="renderedAt" value={props.renderedAt} />
        <input type="hidden" name="phone" value={`${dialCode}${digits}`} />
        <div aria-hidden className="sr-only">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <div className="grid gap-2">
          <label htmlFor="capture-name" className="font-medium text-sm">
            {copy.name}
          </label>
          <input
            ref={nameRef}
            id="capture-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, name: true }))}
            maxLength={120}
            autoComplete="name"
            enterKeyHint="next"
            aria-invalid={showName}
            aria-describedby="capture-name-error"
            className={CONTROL}
          />
          <FieldError id="capture-name-error">{showName ? copy.nameError : null}</FieldError>
        </div>

        <div className="grid gap-2">
          <label htmlFor="capture-phone" className="font-medium text-sm">
            {copy.phone}
          </label>
          <PhoneInput
            ref={phoneRef}
            id="capture-phone"
            value={national}
            onValueChange={setNational}
            onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
            dialCode={dialCode}
            onDialCodeChange={setDialCode}
            dialCodeLabel={copy.dialCode}
            enterKeyHint="done"
            aria-invalid={showPhone}
            aria-describedby="capture-phone-error"
            className="h-12 rounded-xl bg-background"
          />
          <FieldError id="capture-phone-error">{showPhone ? copy.phoneError : null}</FieldError>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 font-medium text-sm">{copy.language}</legend>
          <div className="grid grid-cols-3 gap-2">
            {HOTEL_LANGUAGES.map((language) => (
              <label key={language} className="cursor-pointer">
                <input
                  type="radio"
                  name="language"
                  value={language}
                  defaultChecked={language === props.language}
                  className="peer sr-only"
                />
                <span
                  lang={language}
                  className="flex h-11 items-center justify-center rounded-xl border font-medium text-sm transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
                >
                  {LANGUAGE_NAMES[language]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="font-medium text-sm">{copy.consentTitle}</legend>
          <p className="text-muted-foreground text-sm leading-relaxed">{copy.consentHint}</p>
          <ConsentToggle name="whatsapp" title={copy.whatsappTitle} wording={copy.whatsappWording} />
          <ConsentToggle
            name="emailConsent"
            title={copy.emailTitle}
            wording={copy.emailWording}
            checked={emailConsent}
            onChange={(event) => {
              setEmailConsent(event.target.checked)
              if (event.target.checked && !email.trim()) setOptionalOpen(true)
            }}
          />
          <FieldError id="capture-email-needed">{tried && emailMissing ? copy.emailNeeded : null}</FieldError>
        </fieldset>

        <details
          open={optionalOpen}
          onToggle={(event) => setOptionalOpen(event.currentTarget.open)}
          className="group rounded-xl border"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="grid gap-0.5">
              <span className="font-medium text-sm">{copy.optionalTitle}</span>
              <span className="text-muted-foreground text-xs rtl:text-[0.8125rem]">{copy.optionalHint}</span>
            </span>
            <ChevronDownIcon
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
            />
          </summary>
          <div className="grid gap-6 border-t p-4">
            <div className="grid gap-2">
              <label htmlFor="capture-birthday" className="font-medium text-sm">
                {copy.birthday}
              </label>
              <input id="capture-birthday" type="date" name="birthday" autoComplete="bday" className={CONTROL} />
            </div>
            <div className="grid gap-2">
              <label htmlFor="capture-email" className="font-medium text-sm">
                {copy.email}
              </label>
              <input
                ref={emailRef}
                id="capture-email"
                type="email"
                name="email"
                dir="ltr"
                maxLength={200}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="done"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={tried && emailMissing}
                aria-describedby="capture-email-needed"
                className={CONTROL}
              />
            </div>
          </div>
        </details>

        <div
          aria-live="polite"
          className="sticky bottom-0 z-10 -mx-5 grid sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none gap-2 border-t bg-background/95 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
        >
          {status === "invalid" || status === "tooMany" ? (
            <p role="alert" className="flex items-center gap-1.5 text-destructive text-sm">
              <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
              {status === "invalid" ? copy.errorInvalid : copy.errorTooMany}
            </p>
          ) : null}
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-medium text-base text-primary-foreground transition-opacity duration-150 active:opacity-90"
          >
            {copy.submit}
          </button>
          <p className="text-center text-muted-foreground text-xs rtl:text-[0.8125rem]">{copy.submitHint}</p>
        </div>
      </form>
    </>
  )
}
