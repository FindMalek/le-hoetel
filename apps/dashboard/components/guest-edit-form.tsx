"use client"

import { readPhone, toInternational } from "@ritorno/common/dial"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { parsePhone } from "@ritorno/common/phone"
import { type Guest, guestUpdateSchema } from "@ritorno/common/schemas"
import { isConflict } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { FieldGroup } from "@ritorno/ui/components/field"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { PhoneInput } from "@ritorno/ui/components/phone-input"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { LanguageChoice } from "@/components/language-choice"
import { useRefreshLists } from "@/lib/use-refresh-lists"

type Touched = Partial<Record<"name" | "phone" | "email" | "birthday", boolean>>

export function GuestEditForm({ guest }: { guest: Guest }) {
  const t = useTranslations("guests.edit")
  const tAdd = useTranslations("guests.add")
  const tPicker = useTranslations("countryPicker")
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState(guest.name)
  const [stored] = useState(() => readPhone(guest.phoneE164, { country: "TN", national: "" }))
  const [phone, setPhone] = useState(stored)
  /** The guest who already has the typed number, when the api refused it. */
  const [takenBy, setTakenBy] = useState<{ guestId?: string } | null>(null)
  const [language, setLanguage] = useState<HotelLanguage>(guest.language)
  const [email, setEmail] = useState(guest.email ?? "")
  const [birthday, setBirthday] = useState(guest.birthday ?? "")
  const [checkOut, setCheckOut] = useState(guest.stayCheckOut ?? "")
  const [touched, setTouched] = useState<Touched>({})
  const back = `/guests/${guest.id}`
  const today = new Date().toISOString().slice(0, 10)

  const number = toInternational(phone)
  // an untouched number is not sent, so an old one the parser dislikes never blocks the other fields
  const newPhone = number !== toInternational(stored) && parsePhone(number)?.e164 !== guest.phoneE164

  const problems = {
    name: name.trim() ? null : tAdd("nameRequired"),
    phone: takenBy ? t("phoneTaken") : newPhone && !parsePhone(number) ? tAdd("phoneInvalid") : null,
    email:
      email.trim() === ""
        ? guest.consents.email
          ? t("emailNeeded")
          : null
        : guestUpdateSchema.shape.email.safeParse(email.trim()).success
          ? null
          : tAdd("emailInvalid"),
    birthday: birthday === "" || (birthday >= "1900-01-01" && birthday <= today) ? null : t("birthdayInvalid"),
  }
  const shown = (field: keyof Touched) => (touched[field] ? problems[field] : null)
  const touch = (field: keyof Touched) => setTouched((current) => ({ ...current, [field]: true }))

  const refreshLists = useRefreshLists()
  const save = useMutation(
    orpc.guests.update.mutationOptions({
      onSuccess: (saved) => {
        const whatsappOff = guest.consents.whatsapp && !saved.consents.whatsapp
        toast.success(whatsappOff ? t("savedWhatsappOff") : t("saved"))
        void refreshLists()
        router.push(back as never)
        router.refresh()
      },
      onError: (error) => {
        if (!isConflict(error)) return void toast.error(t("error"))
        setTakenBy((error as { data?: { guestId?: string } }).data ?? {})
        setTouched((current) => ({ ...current, phone: true }))
      },
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (problems.name || problems.phone || problems.email || problems.birthday) {
      setTouched({ name: true, phone: true, email: true, birthday: true })
      return
    }
    save.mutate({
      id: guest.id,
      name: name.trim(),
      ...(newPhone ? { phone: number } : {}),
      language,
      email: email.trim() || null,
      birthday: birthday || null,
      ...(guest.consents.profile ? { stayCheckOut: checkOut || null } : {}),
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-6">
      <FieldGroup>
        <FormField label={tAdd("name")} required error={shown("name")}>
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
            />
          )}
        </FormField>
        <FormField id="edit-phone" label={tAdd("phone")} required error={shown("phone")}>
          {(aria) => (
            <PhoneInput
              {...aria}
              value={phone}
              onValueChange={(value) => {
                setPhone(value)
                setTakenBy(null)
              }}
              locale={locale}
              copy={{
                label: tPicker("label"),
                search: tPicker("search"),
                empty: tPicker("empty"),
                close: tPicker("close"),
              }}
              onBlur={() => touch("phone")}
              autoComplete="off"
            />
          )}
        </FormField>
        {takenBy?.guestId ? (
          <Button
            variant="outline"
            size="lg"
            className="self-start"
            render={<Link href={`/guests/${takenBy.guestId}`} />}
            nativeButton={false}
          >
            {t("openOther")}
          </Button>
        ) : null}
        <div aria-live="polite" className="empty:hidden">
          {newPhone && guest.consents.whatsapp ? <InlineAlert tone="warning" title={t("phoneWhatsappOff")} /> : null}
        </div>
        <LanguageChoice name="edit-language" value={language} onChange={setLanguage} legend={tAdd("language")} />
        <FormField label={t("email")} optional={t("optional")} error={shown("email")}>
          {(aria) => (
            <Input
              {...aria}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => touch("email")}
              maxLength={200}
            />
          )}
        </FormField>
        <FormField label={t("birthday")} optional={t("optional")} error={shown("birthday")}>
          {(aria) => (
            <Input
              {...aria}
              type="date"
              dir="ltr"
              min="1900-01-01"
              max={today}
              value={birthday}
              onChange={(event) => setBirthday(event.target.value)}
              onBlur={() => touch("birthday")}
            />
          )}
        </FormField>
        <FormField
          label={t("checkOut")}
          optional={t("optional")}
          hint={guest.consents.profile ? t("checkOutHint") : t("checkOutNeedsConsent")}
        >
          {(aria) => (
            <Input
              {...aria}
              type="date"
              dir="ltr"
              disabled={!guest.consents.profile}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          )}
        </FormField>
      </FieldGroup>
      <StickyFormActions>
        <Button type="submit" size="lg" loading={save.isPending}>
          {t("submit")}
        </Button>
        <Button variant="ghost" size="lg" render={<Link href={back as never} />} nativeButton={false}>
          {t("cancel")}
        </Button>
      </StickyFormActions>
    </form>
  )
}
