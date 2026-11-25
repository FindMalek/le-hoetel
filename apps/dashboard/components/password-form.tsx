"use client"

import { authClient } from "@le-hoetel/auth/client"
import { Button } from "@le-hoetel/ui/components/button"
import { Checkbox } from "@le-hoetel/ui/components/checkbox"
import { Label } from "@le-hoetel/ui/components/label"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { authErrorKey } from "@/lib/auth-errors"
import { useForm } from "@/lib/use-form"
import { FormField } from "./form-field"
import { PasswordInput } from "./password-input"

const MIN_LENGTH = 10
const BLANK = { current: "", next: "" }

export function PasswordForm() {
  const t = useTranslations("settings")
  const tAuth = useTranslations("auth")
  const [pending, setPending] = useState(false)
  const [revokeOthers, setRevokeOthers] = useState(true)
  const form = useForm(BLANK, (v) => ({
    ...(v.current ? {} : { current: t("errors.currentRequired") }),
    ...(v.next.length >= MIN_LENGTH ? {} : { next: tAuth("errors.passwordShort") }),
  }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.submit()) return
    setPending(true)
    const { error } = await authClient.changePassword({
      currentPassword: form.values.current,
      newPassword: form.values.next,
      revokeOtherSessions: revokeOthers,
    })
    setPending(false)
    if (error) {
      return void toast.error(
        error.code === "INVALID_PASSWORD" ? t("errors.currentWrong") : tAuth(`errors.${authErrorKey(error)}`),
      )
    }
    toast.success(t("passwordChanged"))
    form.reset(BLANK)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormField id="current-password" label={t("currentPassword")} error={form.error("current")}>
        {(aria) => (
          <PasswordInput
            {...aria}
            name="current-password"
            autoComplete="current-password"
            value={form.values.current}
            onChange={(event) => form.set("current", event.target.value)}
            onBlur={() => form.blur("current")}
          />
        )}
      </FormField>
      <FormField id="new-password" label={t("newPassword")} hint={t("newPasswordHint")} error={form.error("next")}>
        {(aria) => (
          <PasswordInput
            {...aria}
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="done"
            value={form.values.next}
            onChange={(event) => form.set("next", event.target.value)}
            onBlur={() => form.blur("next")}
          />
        )}
      </FormField>
      <div className="flex items-center gap-3">
        <Checkbox id="revoke-others" checked={revokeOthers} onCheckedChange={(checked) => setRevokeOthers(checked === true)} />
        <Label htmlFor="revoke-others" className="font-normal">
          {t("signOutOthers")}
        </Label>
      </div>
      <Button type="submit" className="self-start max-md:w-full" loading={pending}>
        {t("changePassword")}
      </Button>
    </form>
  )
}
