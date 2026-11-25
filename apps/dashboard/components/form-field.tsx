"use client"

import { Field, FieldDescription, FieldError, FieldLabel } from "@ritorno/ui/components/field"
import { AlertCircleIcon } from "lucide-react"
import type { ReactNode } from "react"

/** A label above any control, its hint, and an inline error that is announced and linked to the control through `describedBy`. */
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: string
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">{optional}</span> : null}
      </FieldLabel>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
      {error ? (
        <FieldError id={`${id}-error`} className="flex items-center gap-1.5">
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
          {error}
        </FieldError>
      ) : null}
    </Field>
  )
}
