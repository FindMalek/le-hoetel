"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { parsePhone } from "@le-hoetel/common/phone"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Checkbox } from "@le-hoetel/ui/components/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@le-hoetel/ui/components/field"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { PhoneInput } from "@le-hoetel/ui/components/phone-input"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

export function GuestQuickAdd({ defaultLanguage }: { defaultLanguage: HotelLanguage }) {
  const t = useTranslations("guests.add")
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [dialCode, setDialCode] = useState("+216")
  const [phone, setPhone] = useState("")
  const [language, setLanguage] = useState<HotelLanguage>(defaultLanguage)
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState(false)
  const [emailConsent, setEmailConsent] = useState(false)

  const number = `${dialCode} ${phone}`
  const canWhatsapp = parsePhone(number)?.whatsappCapable ?? true
  const hasEmail = email.trim() !== ""

  const add = useMutation(
    orpc.guests.create.mutationOptions({
      onSuccess: (guest) => {
        toast.success(guest.merged ? t("merged") : t("added"))
        setName("")
        setPhone("")
        setEmail("")
        setWhatsapp(false)
        setEmailConsent(false)
        nameInput.current?.focus()
      },
      onError: (error: Error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    add.mutate({
      name,
      phone: number,
      language,
      email: hasEmail ? email : null,
      source: "staff",
      consents: { whatsapp: whatsapp && canWhatsapp, email: emailConsent && hasEmail, profile: false },
    })
  }

  return (
    <form onSubmit={submit} className="max-w-xl">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="quick-name">{t("name")}</FieldLabel>
          <Input
            id="quick-name"
            ref={nameInput}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-phone">{t("phone")}</FieldLabel>
          <PhoneInput
            id="quick-phone"
            value={phone}
            onValueChange={setPhone}
            dialCode={dialCode}
            onDialCodeChange={setDialCode}
            dialCodeLabel={t("dialCode")}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-language">{t("language")}</FieldLabel>
          <select
            id="quick-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as HotelLanguage)}
            className={selectClass}
          >
            {HOTEL_LANGUAGES.map((value) => (
              <option key={value} value={value}>
                {LOCALE_NAMES[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-email">{t("email")}</FieldLabel>
          <Input
            id="quick-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={200}
          />
        </Field>
        <FieldSet>
          <FieldLegend variant="label">{t("consentTitle")}</FieldLegend>
          <FieldDescription>{t("consentHint")}</FieldDescription>
          <div className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox
              id="quick-whatsapp"
              checked={whatsapp && canWhatsapp}
              disabled={!canWhatsapp}
              onCheckedChange={setWhatsapp}
            />
            <Label htmlFor="quick-whatsapp" className="font-normal">
              {canWhatsapp ? t("consentWhatsapp") : t("noWhatsapp")}
            </Label>
          </div>
          <div className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox
              id="quick-email-consent"
              checked={emailConsent && hasEmail}
              disabled={!hasEmail}
              onCheckedChange={setEmailConsent}
            />
            <Label htmlFor="quick-email-consent" className="font-normal">
              {hasEmail ? t("consentEmail") : t("needEmail")}
            </Label>
          </div>
        </FieldSet>
        <Button type="submit" size="lg" className="h-12" disabled={add.isPending}>
          {add.isPending ? t("saving") : t("submit")}
        </Button>
      </FieldGroup>
    </form>
  )
}
