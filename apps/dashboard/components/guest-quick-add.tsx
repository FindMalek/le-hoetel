"use client"

import type { HotelLanguage } from "@le-hoetel/common/hotel"
import { parsePhone } from "@le-hoetel/common/phone"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Checkbox } from "@le-hoetel/ui/components/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@le-hoetel/ui/components/field"
import { InlineAlert } from "@le-hoetel/ui/components/inline-alert"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { PhoneInput } from "@le-hoetel/ui/components/phone-input"
import { StickyFormActions } from "@le-hoetel/ui/components/sticky-form-actions"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { FieldProblem } from "@/components/field-problem"
import { LanguageChoice } from "@/components/language-choice"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Touched = Partial<Record<"name" | "phone" | "email", boolean>>

export function GuestQuickAdd({ defaultLanguage }: { defaultLanguage: HotelLanguage }) {
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
    email: !hasEmail || EMAIL.test(email.trim()) ? null : t("emailInvalid"),
  }
  const touch = (field: keyof Touched) => setTouched((current) => ({ ...current, [field]: true }))
  const shown = (field: keyof Touched) => (touched[field] ? problems[field] : null)

  const add = useMutation(
    orpc.guests.create.mutationOptions({
      onSuccess: (guest) => {
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
        <Field data-invalid={!!shown("phone")}>
          <FieldLabel htmlFor="quick-phone">{t("phone")}</FieldLabel>
          <div ref={phoneBox}>
            <PhoneInput
              id="quick-phone"
              value={phone}
              onValueChange={setPhone}
              dialCode={dialCode}
              onDialCodeChange={setDialCode}
              dialCodeLabel={t("dialCode")}
              enterKeyHint="next"
              onBlur={() => touch("phone")}
              aria-invalid={!!shown("phone")}
              aria-describedby="quick-phone-error"
              autoFocus
            />
          </div>
          <FieldProblem id="quick-phone-error">{shown("phone")}</FieldProblem>
        </Field>
        <Field data-invalid={!!shown("name")}>
          <FieldLabel htmlFor="quick-name">{t("name")}</FieldLabel>
          <Input
            id="quick-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => touch("name")}
            aria-invalid={!!shown("name")}
            aria-describedby="quick-name-error"
            maxLength={120}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
          />
          <FieldProblem id="quick-name-error">{shown("name")}</FieldProblem>
        </Field>
        <LanguageChoice name="quick-language" value={language} onChange={setLanguage} legend={t("language")} />
        <Field data-invalid={!!shown("email")}>
          <FieldLabel htmlFor="quick-email">{t("email")}</FieldLabel>
          <Input
            id="quick-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            enterKeyHint="done"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => touch("email")}
            aria-invalid={!!shown("email")}
            aria-describedby="quick-email-error"
            maxLength={200}
          />
          <FieldProblem id="quick-email-error">{shown("email")}</FieldProblem>
        </Field>
        <FieldSet>
          <FieldLegend variant="label">{t("consentTitle")}</FieldLegend>
          <FieldDescription>{t("consentHint")}</FieldDescription>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="quick-whatsapp"
              className="min-h-12 cursor-pointer gap-3 rounded-lg border px-3 py-2 font-normal has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <Checkbox
                id="quick-whatsapp"
                checked={whatsapp && canWhatsapp}
                disabled={!canWhatsapp}
                onCheckedChange={setWhatsapp}
              />
              {canWhatsapp ? t("consentWhatsapp") : t("noWhatsapp")}
            </Label>
            <Label
              htmlFor="quick-email-consent"
              className="min-h-12 cursor-pointer gap-3 rounded-lg border px-3 py-2 font-normal has-disabled:cursor-not-allowed has-disabled:opacity-60"
            >
              <Checkbox
                id="quick-email-consent"
                checked={emailConsent && hasEmail}
                disabled={!hasEmail}
                onCheckedChange={setEmailConsent}
              />
              {hasEmail ? t("consentEmail") : t("needEmail")}
            </Label>
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
