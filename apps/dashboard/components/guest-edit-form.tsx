"use client"

import type { HotelLanguage } from "@ritorno/common/hotel"
import { type Guest, guestUpdateSchema } from "@ritorno/common/schemas"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { FieldGroup } from "@ritorno/ui/components/field"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { LanguageChoice } from "@/components/language-choice"

type Touched = Partial<Record<"name" | "email" | "birthday", boolean>>

export function GuestEditForm({ guest }: { guest: Guest }) {
  const t = useTranslations("guests.edit")
  const tAdd = useTranslations("guests.add")
  const router = useRouter()
  const [name, setName] = useState(guest.name)
  const [language, setLanguage] = useState<HotelLanguage>(guest.language)
  const [email, setEmail] = useState(guest.email ?? "")
  const [birthday, setBirthday] = useState(guest.birthday ?? "")
  const [touched, setTouched] = useState<Touched>({})
  const back = `/guests/${guest.id}`
  const today = new Date().toISOString().slice(0, 10)

  const problems = {
    name: name.trim() ? null : tAdd("nameRequired"),
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

  const save = useMutation(
    orpc.guests.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("saved"))
        router.push(back as never)
        router.refresh()
      },
      onError: () => toast.error(t("error")),
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (problems.name || problems.email || problems.birthday) {
      setTouched({ name: true, email: true, birthday: true })
      return
    }
    save.mutate({
      id: guest.id,
      name: name.trim(),
      language,
      email: email.trim() || null,
      birthday: birthday || null,
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
