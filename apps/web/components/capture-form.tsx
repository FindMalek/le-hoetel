"use client"

import { isPhoneComplete } from "@ritorno/common/dial"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { Button } from "@ritorno/ui/components/button"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { type CountryPickerCopy, PhoneInput, usePhoneNumber } from "@ritorno/ui/components/phone-input"
import { cn } from "@ritorno/ui/lib/utils"
import { ChevronDownIcon, CircleAlertIcon } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { type CaptureState, captureAction } from "@/app/(guest)/h/[hotelSlug]/actions"
import { ConsentToggle } from "./consent-toggle"

export interface CaptureCopy {
  name: string
  nameError: string
  phone: string
  phoneError: string
  countryPicker: CountryPickerCopy
  language: string
  optionalTitle: string
  optionalHint: string
  birthday: string
  email: string
  emailError: string
  birthdayError: string
  whatsappError: string
  consentTitle: string
  consentHint: string
  whatsappTitle: string
  emailTitle: string
  emailNeeded: string
  submit: string
  sending: string
  submitHint: string
  thanksTitle: string
  thanksBody: string
  thanksPerk: string
  errorInvalid: string
  errorTooMany: string
  errorFailed: string
  whatsappWording: string
  emailWording: string
}

type Status = CaptureState | "sending"

const LANGUAGE_NAMES: Record<HotelLanguage, string> = { en: "English", fr: "Français", ar: "العربية" }
/** Guest inputs are 48 px and stay 16 px on every width, so iOS never zooms. */
const CONTROL = "h-12 rounded-input bg-background text-base md:text-base"

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
  language: HotelLanguage
  perk: ReactNode
  whatsapp: ReactNode
  copy: CaptureCopy
}) {
  const { copy } = props
  const [status, setStatus] = useState<Status>("idle")
  const [name, setName] = useState("")
  const phone = usePhoneNumber({ detect: true })
  const [email, setEmail] = useState("")
  const [emailConsent, setEmailConsent] = useState(false)
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [tried, setTried] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const rejected = status.startsWith("invalid:") ? status.slice("invalid:".length) : null
  const nameBad = name.trim().length < 2
  const phoneBad = !isPhoneComplete(phone.number)
  const emailMissing = emailConsent && !email.trim()
  const nameError = ((touched.name || tried) && nameBad) || rejected === "name" ? copy.nameError : null
  const phoneError =
    rejected === "consents.whatsapp"
      ? copy.whatsappError
      : ((touched.phone || tried) && phoneBad) || rejected === "phone"
        ? copy.phoneError
        : null
  /** A server error leaves with the first edit of the form. */
  const clearRejected = () => rejected && setStatus("idle")
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
    setStatus("sending")
    // The action rejects when the request itself is lost (offline, dropped wifi).
    const result = await captureAction("idle", data).catch(() => "failed" as const)
    setStatus(result)
    if (!result.startsWith("invalid:")) return
    const field = result.slice("invalid:".length)
    if (field === "email" || field === "birthday") setOptionalOpen(true)
    const target = field === "name" ? nameRef : field === "email" ? emailRef : field === "birthday" ? null : phoneRef
    setTimeout(() => (target ? target.current : document.getElementById("capture-birthday"))?.focus(), 0)
  }

  const error = {
    invalid: copy.errorInvalid,
    tooMany: copy.errorTooMany,
    failed: copy.errorFailed,
    idle: null,
    sending: null,
    done: null,
  }[rejected ? "idle" : (status as Exclude<Status, `invalid:${string}`>)]

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
          {props.whatsapp}
        </div>
      ) : null}
      <form
        onSubmit={submit}
        onChange={clearRejected}
        noValidate
        hidden={status === "done"}
        className="flex flex-col gap-6"
      >
        {props.perk}
        <input type="hidden" name="slug" value={props.slug} />
        <input type="hidden" name="source" value={props.source} />
        <input type="hidden" name="location" value={props.location} />
        <input type="hidden" name="phone" value={phone.number} />
        <div aria-hidden className="sr-only">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <FormField id="capture-name" label={copy.name} error={nameError}>
          {(aria) => (
            <Input
              {...aria}
              ref={nameRef}
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, name: true }))}
              maxLength={120}
              autoComplete="name"
              enterKeyHint="next"
              className={CONTROL}
            />
          )}
        </FormField>

        <FormField id="capture-phone" label={copy.phone} error={phoneError}>
          {(aria) => (
            <PhoneInput
              {...aria}
              ref={phoneRef}
              value={phone.value}
              onValueChange={(next) => {
                phone.setValue(next)
                clearRejected()
              }}
              onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
              locale={props.language}
              copy={copy.countryPicker}
              enterKeyHint="done"
              className={CONTROL}
            />
          )}
        </FormField>

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
                  className="flex h-11 items-center justify-center rounded-full border bg-background font-medium text-sm transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
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
          className="group rounded-card border"
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
            <FormField
              id="capture-birthday"
              label={copy.birthday}
              error={rejected === "birthday" ? copy.birthdayError : null}
            >
              {(aria) => <Input {...aria} type="date" name="birthday" autoComplete="bday" className={CONTROL} />}
            </FormField>
            <FormField id="capture-email" label={copy.email} error={rejected === "email" ? copy.emailError : null}>
              {(aria) => (
                <Input
                  {...aria}
                  ref={emailRef}
                  type="email"
                  name="email"
                  maxLength={200}
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="done"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={(tried && emailMissing) || rejected === "email"}
                  aria-describedby={rejected === "email" ? aria["aria-describedby"] : "capture-email-needed"}
                  className={CONTROL}
                />
              )}
            </FormField>
          </div>
        </details>

        <div
          aria-live="polite"
          className="sticky bottom-0 z-10 -mx-5 grid sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none gap-2 border-t bg-background/95 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm"
        >
          {error ? (
            <p role="alert" className="flex items-center gap-1.5 text-destructive text-sm">
              <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" loading={status === "sending"} className="w-full">
            {status === "sending" ? copy.sending : copy.submit}
          </Button>
          <p className="text-center text-muted-foreground text-xs rtl:text-[0.8125rem]">{copy.submitHint}</p>
        </div>
      </form>
      {status === "done" || !props.whatsapp ? null : <div className="mt-6 border-t pt-6">{props.whatsapp}</div>}
    </>
  )
}
