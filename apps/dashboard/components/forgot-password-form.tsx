"use client"

import { authClient } from "@ritorno/auth/client"
import { emailSchema } from "@ritorno/common/schemas"
import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { MailCheckIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { AuthField } from "@/components/auth-field"
import { authErrorKey } from "@/lib/auth-errors"

export function ForgotPasswordForm() {
  const t = useTranslations("auth")
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = (value: string) =>
    !value.trim() ? t("errors.required") : emailSchema.safeParse(value.trim()).success ? null : t("errors.email")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim()
    const invalid = check(email)
    setError(invalid)
    setFormError(null)
    if (invalid) return
    setBusy(true)
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
    setBusy(false)
    if (result.error) return setFormError(t(`errors.${authErrorKey(result.error)}`))
    setSentTo(email)
  }

  if (sentTo)
    return (
      <div className="flex flex-col gap-6" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-surface">
          <MailCheckIcon aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-h1">{t("forgot.sentTitle")}</h1>
          <p className="text-pretty text-muted-foreground">{t("forgot.sent", { email: sentTo })}</p>
        </div>
        <Button variant="secondary" size="lg" render={<Link href="/sign-in" />} nativeButton={false}>
          {t("back")}
        </Button>
      </div>
    )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-h1">{t("forgot.title")}</h1>
        <p className="text-muted-foreground">{t("forgot.description")}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {formError ? <InlineAlert tone="error">{formError}</InlineAlert> : null}
        <AuthField
          name="email"
          type="email"
          label={t("email")}
          autoComplete="email"
          inputMode="email"
          enterKeyHint="send"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
          error={error}
          onBlur={(event) => setError(check(event.target.value))}
          required
        />
        <Button type="submit" size="lg" loading={busy}>
          {t("forgot.submit")}
        </Button>
      </form>
      <Link
        href="/sign-in"
        className="inline-flex min-h-touch items-center justify-center text-blue-700 text-sm underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>
    </div>
  )
}
