"use client"

import { authClient } from "@le-hoetel/auth/client"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { FieldGroup, FieldSeparator } from "@le-hoetel/ui/components/field"
import { InlineAlert } from "@le-hoetel/ui/components/inline-alert"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { type FocusEvent, type FormEvent, useState } from "react"
import { AuthField } from "@/components/auth-field"
import { authErrorKey } from "@/lib/auth-errors"

type Field = "name" | "email" | "password"
type Errors = Partial<Record<Field, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthForm({
  mode,
  next,
  reset = false,
}: {
  mode: "sign-in" | "sign-up"
  next: string
  reset?: boolean
}) {
  const t = useTranslations("auth")
  const signUp = mode === "sign-up"
  const copy = signUp ? "signUp" : "signIn"
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const providers = useQuery(orpc.public.authProviders.queryOptions())
  const withNext = (path: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`)

  const check = (field: Field, value: string): string | undefined => {
    if (!value.trim()) return t("errors.required")
    if (field === "email" && !EMAIL.test(value.trim())) return t("errors.email")
    if (field === "password" && signUp && value.length < 10) return t("errors.passwordShort")
    return undefined
  }

  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    const field = event.target.name as Field
    setErrors((current) => ({ ...current, [field]: check(field, event.target.value) }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    }
    const fields: Field[] = signUp ? ["name", "email", "password"] : ["email", "password"]
    const found: Errors = {}
    for (const field of fields) found[field] = check(field, values[field])
    setErrors(found)
    setFormError(null)
    if (fields.some((field) => found[field])) {
      document.getElementById(fields.find((field) => found[field]) ?? "email")?.focus()
      return
    }
    setBusy(true)
    const result = signUp
      ? await authClient.signUp.email(values)
      : await authClient.signIn.email({ email: values.email, password: values.password })
    if (result.error) {
      setFormError(t(`errors.${authErrorKey(result.error)}`))
      setBusy(false)
      return
    }
    window.location.assign(next)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight">{t(`${copy}.title`)}</h1>
        <p className="text-muted-foreground">{t(`${copy}.description`)}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {reset && !formError ? <InlineAlert tone="success">{t("reset.done")}</InlineAlert> : null}
        {formError ? <InlineAlert tone="error">{formError}</InlineAlert> : null}
        <FieldGroup>
          {providers.data?.github ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => authClient.signIn.social({ provider: "github", callbackURL: next })}
              >
                {t("github")}
              </Button>
              <FieldSeparator>{t("or")}</FieldSeparator>
            </>
          ) : null}
          {signUp ? (
            <AuthField
              name="name"
              label={t("signUp.name")}
              autoComplete="name"
              enterKeyHint="next"
              error={errors.name}
              onBlur={onBlur}
              required
            />
          ) : null}
          <AuthField
            name="email"
            type="email"
            label={t("email")}
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            error={errors.email}
            onBlur={onBlur}
            required
          />
          <AuthField
            name="password"
            type="password"
            label={t("password")}
            autoComplete={signUp ? "new-password" : "current-password"}
            enterKeyHint="go"
            hint={signUp ? t("signUp.hint") : undefined}
            error={errors.password}
            onBlur={onBlur}
            required
            labelAction={
              signUp ? null : (
                <Link
                  href="/forgot-password"
                  className="inline-flex min-h-touch items-center text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("signIn.forgot")}
                </Link>
              )
            }
          />
        </FieldGroup>
        <Button type="submit" size="lg" loading={busy}>
          {t(`${copy}.submit`)}
        </Button>
      </form>
      <p className="text-center text-muted-foreground text-sm">
        {signUp ? t("signUp.have") : t("signIn.noAccount")}
        <Link
          href={withNext(signUp ? "/sign-in" : "/sign-up") as "/sign-in"}
          className="ms-1 inline-flex min-h-touch items-center font-medium text-foreground underline-offset-4 hover:underline"
        >
          {signUp ? t("signUp.signIn") : t("signIn.create")}
        </Link>
      </p>
    </div>
  )
}
