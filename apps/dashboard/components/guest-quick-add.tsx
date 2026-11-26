"use client"

import { consentWording } from "@ritorno/common/consent"
import { invalidField } from "@ritorno/common/field-errors"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { parsePhone } from "@ritorno/common/phone"
import { type GuestUpsertResult, guestCreateSchema } from "@ritorno/common/schemas"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@ritorno/ui/components/field"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { PhoneInput, usePhoneNumber } from "@ritorno/ui/components/phone-input"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { useMutation, useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { type FormEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { LanguageChoice } from "@/components/language-choice"
import { MarkVisitButton } from "@/components/mark-visit-button"
import { useDebounced } from "@/lib/use-debounced"
import { useRefreshLists } from "@/lib/use-refresh-lists"

type Touched = Partial<Record<"name" | "phone" | "email", boolean>>

export function GuestQuickAdd({ defaultLanguage, hotelName }: { defaultLanguage: HotelLanguage; hotelName: string }) {
  const t = useTranslations("guests.add")
  const tPicker = useTranslations("countryPicker")
  const locale = useLocale()
  const phoneBox = useRef<HTMLDivElement>(null)
  const [name, setName] = useState("")
  // staff type the guest's number, so their own browser's country says nothing
  const phone = usePhoneNumber({ detect: false })
  const [picked, setPicked] = useState<HotelLanguage | null>(null)
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState(false)
  const [emailConsent, setEmailConsent] = useState(false)
  const [touched, setTouched] = useState<Touched>({})
  const [last, setLast] = useState<GuestUpsertResult | null>(null)

  const { number } = phone
  const parsed = parsePhone(number)
  const canWhatsapp = parsed?.whatsappCapable ?? true
  const hasEmail = email.trim() !== ""

  const lookup = useDebounced(parsed?.e164 ?? "")
  const found = useQuery({ ...orpc.guests.find.queryOptions({ input: { q: lookup } }), enabled: lookup !== "" })
  const known = found.data?.find((guest) => guest.phoneE164 === parsed?.e164)
  // the form's default language must not overwrite the one the guest already has
  const language = picked ?? known?.language ?? defaultLanguage

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
        setLast(guest)
        setName("")
        phone.setValue((current) => ({ ...current, national: "" }))
        setEmail("")
        setWhatsapp(false)
        setEmailConsent(false)
        setTouched({})
        setPicked(null)
        phoneBox.current?.querySelector("input")?.focus()
      },
      onError: (error) => {
        const field = invalidField(error)
        const message = { name: "nameRequired", phone: "phoneInvalid", email: "emailInvalid" } as const
        const whatsappRefused = field === "consents.whatsapp"
        const key = message[field as keyof typeof message]
        toast.error(t(whatsappRefused ? "noWhatsapp" : (key ?? "error")))
      },
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
        >
          {last.merged ? <MergeSummary result={last} /> : null}
        </InlineAlert>
      )}
      <FieldGroup>
        <FormField id="quick-phone" label={t("phone")} required error={shown("phone")}>
          {(aria) => (
            <div ref={phoneBox}>
              <PhoneInput
                {...aria}
                value={phone.value}
                onValueChange={(value) => {
                  phone.setValue(value)
                  setPicked(null)
                }}
                locale={locale}
                copy={{
                  label: tPicker("label"),
                  search: tPicker("search"),
                  empty: tPicker("empty"),
                  close: tPicker("close"),
                }}
                enterKeyHint="next"
                onBlur={() => touch("phone")}
                autoFocus
              />
            </div>
          )}
        </FormField>
        <div aria-live="polite" className="empty:hidden">
          {known && <KnownGuest guest={known} />}
        </div>
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
        <LanguageChoice name="quick-language" value={language} onChange={setPicked} legend={t("language")} />
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

function KnownGuest({ guest }: { guest: { id: string; name: string; visits: number; visitedToday: boolean } }) {
  const t = useTranslations("guests.add")
  const tFinder = useTranslations("guests.finder")
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-muted-foreground text-sm">{t("known")}</p>
        <Link
          href={`/guests/${guest.id}`}
          className="flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          <span dir="auto" className="truncate">
            {guest.name}
          </span>
        </Link>
        <p className="text-sm">
          {guest.visits >= 2 ? tFinder("welcomeBack", { count: guest.visits }) : tFinder("firstStay")}
        </p>
      </div>
      <MarkVisitButton guestId={guest.id} visitedToday={guest.visitedToday} />
    </div>
  )
}

// i18n-used: guests.add.fields.name
// i18n-used: guests.add.fields.language
// i18n-used: guests.add.fields.email
// i18n-used: guests.add.fields.birthday
// i18n-used: guests.add.fields.country
// i18n-used: guests.add.fields.city
// i18n-used: guests.add.fields.stayCheckIn
// i18n-used: guests.add.fields.stayCheckOut
// i18n-used: guests.add.fields.nextDestination
// i18n-used: guests.add.fields.emailConsent
// i18n-used: guests.add.fields.whatsappConsent
// i18n-used: guests.add.fields.profileConsent
function MergeSummary({ result }: { result: GuestUpsertResult }) {
  const t = useTranslations("guests.add")
  const format = useFormatter()
  const names = (fields: GuestUpsertResult["changed"]) => format.list(fields.map((field) => t(`fields.${field}`)))
  return (
    <span className="flex flex-col">
      <span>{result.changed.length ? t("changed", { fields: names(result.changed) }) : t("unchanged")}</span>
      {result.kept.length > 0 && <span>{t("kept", { fields: names(result.kept) })}</span>}
      <span>{result.visitRecorded ? t("visitSaved") : t("visitCounted")}</span>
    </span>
  )
}
