"use client"

import { consentWording } from "@ritorno/common/consent"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { parsePhone } from "@ritorno/common/phone"
import { guestCreateSchema } from "@ritorno/common/schemas"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@ritorno/ui/components/field"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { PhoneInput } from "@ritorno/ui/components/phone-input"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { LanguageChoice } from "@/components/language-choice"
import { useRefreshLists } from "@/lib/use-refresh-lists"

type Touched = Partial<Record<"name" | "phone" | "email", boolean>>

export function GuestQuickAdd({ defaultLanguage, hotelName }: { defaultLanguage: HotelLanguage; hotelName: string }) {
  const t = useTranslations("guests.add")
  const phoneBox = useRef<HTMLDivElement>(null)
  const [name, setName] = useState("")
  const [dialCode, setDialCode] = useState("+216")
  const [phone, setPhone] = useState("")
  const [language, setLanguage] = useState<HotelLanguage>(defaultLanguage)
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState(false)
  const [emailConsent, setEmailConsent] = useState(false)
  const [touched, setTouched] = useState<Touched>({})
  const [last, setLast] = useState<{ id: string; merged: boolean } | null>(null)

  const number = `${dialCode} ${phone}`
  const parsed = parsePhone(number)
  const canWhatsapp = parsed?.whatsappCapable ?? true
  const hasEmail = email.trim() !== ""

  const problems = {
    name: name.trim() ? null : t("nameRequired"),
    phone: parsed ? null : t("phoneInvalid"),
    email: !hasEmail || guestCreateSchema.shape.email.safeParse(email.trim()).success ? null : t("emailInvalid"),
  }
  const touch = (field: keyof Touched) => setTouched((current) => ({ ...current, [field]: true }))
  const shown = (field: keyof Touched) => (touched[field] ? problems[field] : null)

  const refreshLists = useRefreshLists()
  const add = useMutation(
    orpc.guests.create.mutationOptions({
      onSuccess: (guest) => {
        void refreshLists()
        toast.success(guest.merged ? t("merged") : t("added"))
        setLast({ id: guest.id, merged: guest.merged })
        setName("")
        setPhone("")
        setEmail("")
        setWhatsapp(false)
        setEmailConsent(false)
        setTouched({})
        phoneBox.current?.querySelector("input")?.focus()
      },
      onError: () => toast.error(t("error")),
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (problems.name || problems.phone || problems.email) {
      setTouched({ name: true, phone: true, email: true })
      return
    }
    add.mutate({
      name: name.trim(),
      phone: number,
      language,
      email: hasEmail ? email.trim() : null,
      source: "staff",
      consents: { whatsapp: whatsapp && canWhatsapp, email: emailConsent && hasEmail, profile: false },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-6">
      {last && (
        <InlineAlert
          tone="success"
          title={last.merged ? t("merged") : t("added")}
          action={
            <Button variant="outline" size="sm" render={<Link href={`/guests/${last.id}`} />} nativeButton={false}>
              {t("view")}
            </Button>
          }
        />
      )}
      <FieldGroup>
        <FormField id="quick-phone" label={t("phone")} required error={shown("phone")}>
          {(aria) => (
            <div ref={phoneBox}>
              <PhoneInput
                {...aria}
                value={phone}
                onValueChange={setPhone}
                dialCode={dialCode}
                onDialCodeChange={setDialCode}
                dialCodeLabel={t("dialCode")}
                enterKeyHint="next"
                onBlur={() => touch("phone")}
                autoFocus
              />
            </div>
          )}
        </FormField>
        <FormField id="quick-name" label={t("name")} required error={shown("name")}>
          {(aria) => (
            <Input
              {...aria}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => touch("name")}
              required
              maxLength={120}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
            />
          )}
        </FormField>
        <LanguageChoice name="quick-language" value={language} onChange={setLanguage} legend={t("language")} />
        <FormField id="quick-email" label={t("email")} error={shown("email")}>
          {(aria) => (
            <Input
              {...aria}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="done"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => touch("email")}
              maxLength={200}
            />
          )}
        </FormField>
        <FieldSet>
          <FieldLegend variant="label">{t("consentTitle")}</FieldLegend>
          <FieldDescription>{t("consentHint")}</FieldDescription>
          <div className="flex flex-col gap-2">
            <ConsentBox
              id="quick-whatsapp"
              checked={whatsapp && canWhatsapp}
              disabled={!canWhatsapp}
              onCheckedChange={setWhatsapp}
              title={canWhatsapp ? t("consentWhatsapp") : t("noWhatsapp")}
              wording={consentWording("whatsapp", language, hotelName)}
            />
            <ConsentBox
              id="quick-email-consent"
              checked={emailConsent && hasEmail}
              disabled={!hasEmail}
              onCheckedChange={setEmailConsent}
              title={hasEmail ? t("consentEmail") : t("needEmail")}
              wording={consentWording("email", language, hotelName)}
            />
          </div>
        </FieldSet>
      </FieldGroup>
      <StickyFormActions>
        <Button type="submit" size="lg" loading={add.isPending}>
          {t("submit")}
        </Button>
        <Button variant="ghost" size="lg" render={<Link href="/guests" />} nativeButton={false}>
          {t("done")}
        </Button>
      </StickyFormActions>
    </form>
  )
}

function ConsentBox({
  id,
  checked,
  disabled,
  onCheckedChange,
  title,
  wording,
}: {
  id: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
  title: string
  wording: string
}) {
  return (
    <Label
      htmlFor={id}
      className="min-h-12 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal has-checked:border-primary has-disabled:cursor-not-allowed has-disabled:opacity-60"
    >
      <Checkbox id={id} className="mt-0.5" checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      <span className="grid gap-1">
        <span className="font-medium">{title}</span>
        <span dir="auto" className="text-muted-foreground text-sm">
          {wording}
        </span>
      </span>
    </Label>
  )
}
