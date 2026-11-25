"use client"

import { Field, FieldDescription, FieldError, FieldLabel } from "@le-hoetel/ui/components/field"
import { Input } from "@le-hoetel/ui/components/input"
import { AlertCircleIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { PasswordInput } from "@/components/password-input"

type AuthFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  name: string
  label: string
  hint?: string
  error?: string | null
  labelAction?: ReactNode
}

/** A labelled input with its hint and an inline error that is announced and linked to the input. */
export function AuthField({ name, label, hint, error, labelAction, type = "text", ...props }: AuthFieldProps) {
  const errorId = `${name}-error`
  const hintId = `${name}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined
  const shared = { id: name, name, "aria-invalid": Boolean(error), "aria-describedby": describedBy, ...props }
  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        {labelAction}
      </div>
      {type === "password" ? <PasswordInput {...shared} /> : <Input {...shared} type={type} />}
      {hint && !error ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
      {error ? (
        <FieldError id={errorId} className="flex items-center gap-1.5">
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </FieldError>
      ) : null}
    </Field>
  )
}
