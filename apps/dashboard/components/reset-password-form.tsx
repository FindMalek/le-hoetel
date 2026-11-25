"use client"

import { authClient } from "@ritorno/auth/client"
import { Button } from "@ritorno/ui/components/button"
import { LinkIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { AuthField } from "@/components/auth-field"

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("auth")
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [invalid, setInvalid] = useState(!token)
  const [busy, setBusy] = useState(false)

  if (invalid)
    return (
      <div className="flex flex-col gap-6">
        <span className="grid size-12 place-items-center rounded-lg bg-muted">
          <LinkIcon aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading font-semibold text-3xl tracking-tight">{t("reset.invalidTitle")}</h1>
          <p className="text-pretty text-muted-foreground">{t("reset.invalid")}</p>
        </div>
        <Button size="lg" render={<Link href="/forgot-password" />} nativeButton={false}>
          {t("reset.again")}
        </Button>
      </div>
    )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") ?? "")
    const confirm = String(form.get("confirm") ?? "")
    const found = {
      password: password.length < 10 ? t("errors.passwordShort") : undefined,
      confirm: confirm !== password ? t("reset.mismatch") : undefined,
    }
    setErrors(found)
    if (found.password || found.confirm) return
    setBusy(true)
    const result = await authClient.resetPassword({ newPassword: password, token: token ?? "" })
    if (result.error) {
      setInvalid(true)
      return setBusy(false)
    }
    window.location.assign("/sign-in?reset=1")
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight">{t("reset.title")}</h1>
        <p className="text-muted-foreground">{t("reset.description")}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <AuthField
          name="password"
          type="password"
          label={t("reset.password")}
          autoComplete="new-password"
          enterKeyHint="next"
          hint={t("signUp.hint")}
          error={errors.password}
          required
        />
        <AuthField
          name="confirm"
          type="password"
          label={t("reset.confirm")}
          autoComplete="new-password"
          enterKeyHint="go"
          error={errors.confirm}
          required
        />
        <Button type="submit" size="lg" loading={busy}>
          {t("reset.submit")}
        </Button>
      </form>
    </div>
  )
}
